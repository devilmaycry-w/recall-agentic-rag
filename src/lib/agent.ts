import { CHUNKS, type Doc } from "./mock-data";
import { runSql } from "./sql";

export type RouteKind = "Document Retrieval" | "Read-Only SQL" | "Clarification";
export type Verification =
  | { kind: "Grounded" }
  | { kind: "Corrected"; retry: number; max: number }
  | { kind: "Abstained" };

export interface Citation { docName: string; page: number; confidence: number; snippet: string; chunkId: string }
export interface TraceStep { name: string; detail: string; ms: number; status: "ok" | "warn" | "fail" | "skip" }
export interface AgentAnswer {
  route: RouteKind;
  content: string;
  citations: Citation[];
  verification: Verification;
  trace: TraceStep[];
  sql?: { query: string; columns: string[]; rows: Record<string, unknown>[] };
  latencyMs: number;
}

const STOP = new Set("the a an of to and or is are what how for in on with do does i we our my can when much many per be by at it this that".split(" "));
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export function routeQuery(q: string): RouteKind {
  const t = q.toLowerCase();
  if (terms(q).length < 2 || /^(help|hi|hello|it|that|this)\b/.test(t.trim())) return "Clarification";
  if (/\b(revenue|sales|units|sold|inventory|stock|on hand|reorder|warehouse|top region|quarter|q[1-4])\b/.test(t)) return "Read-Only SQL";
  return "Document Retrieval";
}

function buildSql(q: string): string {
  const t = q.toLowerCase();
  if (/inventory|stock|reorder|warehouse|on hand/.test(t)) {
    if (/low|below|reorder/.test(t)) return "SELECT sku, product, warehouse, on_hand, reorder_point FROM inventory WHERE on_hand < 30 ORDER BY on_hand";
    return "SELECT product, sum(on_hand) as total_on_hand FROM inventory GROUP BY product ORDER BY total_on_hand DESC";
  }
  const q3 = t.match(/q([1-4])/);
  const where = q3 ? ` WHERE quarter = '2026-Q${q3[1]}'` : "";
  if (/product/.test(t)) return `SELECT product, sum(revenue) as revenue, sum(units) as units FROM sales${where} GROUP BY product ORDER BY revenue DESC`;
  return `SELECT region, sum(revenue) as revenue, sum(units) as units FROM sales${where} GROUP BY region ORDER BY revenue DESC`;
}

const r = (a: number, b: number) => Math.round(a + Math.random() * (b - a));

export function runAgent(query: string, docs: Doc[]): AgentAnswer {
  const route = routeQuery(query);
  const trace: TraceStep[] = [{ name: "Query Routing", detail: `Classified intent → ${route}`, ms: r(40, 90), status: "ok" }];

  if (route === "Clarification") {
    trace.push(
      { name: "Document Retrieval", detail: "Skipped — query underspecified", ms: 0, status: "skip" },
      { name: "Relevance Grading", detail: "Skipped", ms: 0, status: "skip" },
      { name: "Answer Generation", detail: "Generated clarifying question", ms: r(200, 400), status: "ok" },
      { name: "Groundedness Check", detail: "Not applicable", ms: 0, status: "skip" },
    );
    return {
      route, trace, citations: [], verification: { kind: "Grounded" },
      content: "Could you be more specific? For example, are you asking about a **policy** (e.g. PTO, remote work), **product specs** (e.g. R-200 payload), or **business numbers** (e.g. Q3 revenue by region)?",
      latencyMs: trace.reduce((a, s) => a + s.ms, 0),
    };
  }

  if (route === "Read-Only SQL") {
    const sql = buildSql(query);
    const res = runSql(sql);
    trace.push({ name: "SQL Generation", detail: sql, ms: r(150, 300), status: "ok" });
    trace.push({ name: "Guardrail Check", detail: "SELECT-only · single statement · table allow-list · row cap 50", ms: r(5, 15), status: "ok" });
    if (!res.ok) {
      trace.push({ name: "Answer Generation", detail: res.error, ms: 0, status: "fail" });
      return { route, trace, citations: [], verification: { kind: "Abstained" }, content: `I couldn't run that query safely: ${res.error}.`, latencyMs: 300 };
    }
    trace.push({ name: "Query Execution", detail: `${res.rows.length} rows in ${res.ms}ms (read replica)`, ms: res.ms + r(20, 60), status: "ok" });
    const top = res.rows[0];
    const k1 = res.columns[0] ?? "", k2 = res.columns[1] ?? k1;
    trace.push({ name: "Answer Generation", detail: "Summarized result set", ms: r(300, 600), status: "ok" });
    trace.push({ name: "Groundedness Check", detail: "All figures match result rows", ms: r(100, 200), status: "ok" });
    const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString() : String(v));
    return {
      route, trace, citations: [], verification: { kind: "Grounded" },
      content: top ? `Based on the **${sql.match(/from (\w+)/i)?.[1]}** table, the top entry is **${fmt(top[k1])}** with ${k2.replace(/_/g, " ")} of **${fmt(top[k2])}**. Full results are below.` : "The query returned no rows.",
      sql: { query: sql, columns: res.columns, rows: res.rows },
      latencyMs: trace.reduce((a, s) => a + s.ms, 0),
    };
  }

  // Document retrieval
  const indexed = new Map(docs.filter((d) => d.status === "Indexed").map((d) => [d.id, d]));
  const qt = terms(query);
  const scored = CHUNKS.filter((c) => indexed.has(c.docId))
    .map((c) => {
      const ct = new Set(terms(c.text));
      const hits = qt.filter((w) => ct.has(w) || [...ct].some((x) => x.startsWith(w.slice(0, 5)))).length;
      return { c, score: qt.length ? hits / qt.length : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  trace.push({ name: "Document Retrieval", detail: `Hybrid search over ${indexed.size} indexed docs · top-5 chunks`, ms: r(90, 180), status: "ok" });
  const relevant = top.filter((s) => s.score >= 0.34);
  trace.push({
    name: "Relevance Grading",
    detail: `${relevant.length}/${top.length} chunks graded relevant (threshold 0.34)`,
    ms: r(200, 350),
    status: relevant.length ? "ok" : "warn",
  });

  if (!relevant.length) {
    trace.push({ name: "Query Rewrite", detail: "Retry 1/2: expanded query with synonyms", ms: r(150, 250), status: "warn" });
    trace.push({ name: "Document Retrieval", detail: "Retry 2/2: still no relevant evidence", ms: r(90, 150), status: "fail" });
    trace.push({ name: "Answer Generation", detail: "Abstained", ms: r(80, 120), status: "skip" });
    trace.push({ name: "Groundedness Check", detail: "Insufficient evidence — refusing to guess", ms: r(50, 90), status: "fail" });
    return {
      route, trace, citations: [], verification: { kind: "Abstained" },
      content: "I couldn't find enough evidence in this workspace's documents to answer that reliably. Try rephrasing, or ask a Knowledge Manager to upload a relevant source.",
      latencyMs: trace.reduce((a, s) => a + s.ms, 0),
    };
  }

  const best = relevant.slice(0, 2);
  const citations: Citation[] = best.map(({ c, score }) => ({
    docName: indexed.get(c.docId)!.name, page: c.page, chunkId: c.id,
    confidence: Math.min(0.99, 0.55 + score * 0.45), snippet: c.text,
  }));
  // Deterministic "self-correction": answers built from a single weak chunk need a retry
  const needsRetry = best[0]!.score < 0.6;
  trace.push({ name: "Answer Generation", detail: `Drafted answer from ${best.length} chunk(s)`, ms: r(500, 900), status: "ok" });
  if (needsRetry) {
    trace.push({ name: "Groundedness Check", detail: "1 unsupported claim detected → regenerate", ms: r(200, 300), status: "warn" });
    trace.push({ name: "Answer Generation", detail: "Retry 1/2: constrained to cited spans", ms: r(400, 700), status: "ok" });
    trace.push({ name: "Groundedness Check", detail: "All claims supported (score 0.94)", ms: r(200, 300), status: "ok" });
  } else {
    trace.push({ name: "Groundedness Check", detail: "All claims supported (score 0.97)", ms: r(200, 300), status: "ok" });
  }
  const content = best.map(({ c }, i) => `${c.text} [${i + 1}]`).join(" ");
  return {
    route, trace, citations, content,
    verification: needsRetry ? { kind: "Corrected", retry: 1, max: 2 } : { kind: "Grounded" },
    latencyMs: trace.reduce((a, s) => a + s.ms, 0),
  };
}
