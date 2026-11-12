/**
 * Central API client for the RECALL FastAPI backend.
 * All response mapping lives here — backend response shapes are not yet verified,
 * so mappers read fields defensively and keep the original payload in `raw`.
 */
import { ENDPOINTS, getSettings } from "./config";
import { demoAgent, demoSearch } from "./mock";

export type Route = "DOCUMENT_SEARCH" | "SQL_QUERY" | "CLARIFICATION" | "GENERAL" | "UNKNOWN";
export type Verification = "SUPPORTED" | "CORRECTED" | "ABSTAINED" | "NOT_EVALUATED";
export type DocStatus = "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";

export interface SearchResult { filename?: string | undefined; page?: number | undefined; chunkIndex?: number | undefined; score?: number | undefined; scoreLabel?: string | undefined; text: string; }
export interface TraceStep { name: string; status: "done" | "error" | "skipped" | "unknown"; durationMs?: number | undefined; details?: string | undefined; meta?: unknown; }
export interface AgentResult { answer: string; route: Route; verification: Verification; sources: SearchResult[]; latencyMs: number; trace: TraceStep[]; raw: unknown; }
export interface DocumentRecord { id: string; filename: string; status: DocStatus; fileType: string; }
export interface HealthResult { ok: boolean; latencyMs: number; data?: unknown; error?: string | undefined; }

export class ApiError extends Error { constructor(msg: string, public status?: number) { super(msg); } }

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const pick = (o: Obj, ...keys: string[]) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !isNaN(+v) ? +v : undefined);

async function request<T = unknown>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<{ data: T; latencyMs: number }> {
  const { apiBaseUrl, timeoutMs } = getSettings();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  signal?.addEventListener("abort", () => ctrl.abort(signal.reason));
  const t0 = performance.now();
  try {
    const res = await fetch(apiBaseUrl.replace(/\/$/, "") + path, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* plain text */ }
    if (!res.ok) {
      const detail = isObj(data) ? String(pick(data, "detail", "message", "error") ?? res.statusText) : res.statusText;
      throw new ApiError(`${res.status} ${detail}`, res.status);
    }
    return { data: data as T, latencyMs: Math.round(performance.now() - t0) };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (signal?.aborted) throw new ApiError("Request cancelled");
    if (ctrl.signal.aborted) throw new ApiError(`Timed out after ${timeoutMs} ms`);
    throw new ApiError("Backend unreachable — is FastAPI running at " + apiBaseUrl + "?");
  } finally { clearTimeout(timer); }
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/* ---------- mappers ---------- */
export function normalizeRoute(v: unknown): Route {
  const s = String(v ?? "").toUpperCase().replace(/[\s-]/g, "_");
  if (s.includes("SQL")) return "SQL_QUERY";
  if (s.includes("CLARIF")) return "CLARIFICATION";
  if (s.includes("DOC") || s.includes("RETRIEV") || s.includes("RAG") || s.includes("SEARCH")) return "DOCUMENT_SEARCH";
  if (s.includes("GENERAL") || s.includes("CHAT")) return "GENERAL";
  return "UNKNOWN";
}
export function normalizeVerification(v: unknown): Verification {
  if (isObj(v)) v = pick(v, "status", "verdict", "result", "label");
  const s = String(v ?? "").toUpperCase();
  if (s.includes("SUPPORT") || s === "PASS" || s === "GROUNDED") return "SUPPORTED";
  if (s.includes("CORRECT") || s.includes("REVIS")) return "CORRECTED";
  if (s.includes("ABSTAIN") || s.includes("REFUS") || s.includes("UNSUPPORT")) return "ABSTAINED";
  return "NOT_EVALUATED";
}
export function mapChunk(c: unknown): SearchResult {
  if (!isObj(c)) return { text: String(c) };
  const meta = isObj(c["metadata"]) ? c["metadata"] : {};
  const m = { ...meta, ...c };
  const dist = num(pick(m, "distance"));
  const sim = num(pick(m, "similarity", "score"));
  return {
    filename: pick(m, "filename", "file_name", "source", "document_name") as string | undefined,
    page: num(pick(m, "page", "page_number")),
    chunkIndex: num(pick(m, "chunk_index", "chunk_id", "index")),
    score: dist ?? sim,
    scoreLabel: dist !== undefined ? "distance" : sim !== undefined ? "similarity" : undefined,
    text: String(pick(m, "text", "content", "chunk_text", "page_content") ?? ""),
  };
}
function mapResults(d: unknown): SearchResult[] {
  const arr = Array.isArray(d) ? d : isObj(d) ? pick(d, "results", "chunks", "matches", "documents", "sources") : undefined;
  return Array.isArray(arr) ? arr.map(mapChunk) : [];
}
function mapTrace(d: Obj): TraceStep[] {
  const t = pick(d, "trace", "steps", "agent_trace", "execution_trace");
  if (!Array.isArray(t)) return [];
  return t.map((s, i) => {
    if (!isObj(s)) return { name: String(s), status: "unknown" as const };
    const st = String(pick(s, "status") ?? "").toLowerCase();
    return {
      name: String(pick(s, "name", "step", "node", "stage") ?? `Step ${i + 1}`),
      status: st.includes("err") || st.includes("fail") ? "error" : st.includes("skip") ? "skipped" : st ? "done" : "unknown",
      durationMs: num(pick(s, "duration_ms", "durationMs", "latency_ms")),
      details: pick(s, "details", "detail", "message") as string | undefined,
      meta: s,
    };
  });
}
export function mapAgent(d: unknown, latencyMs: number): AgentResult {
  const o = isObj(d) ? d : { answer: d };
  return {
    answer: String(pick(o, "answer", "final_answer", "response", "result", "output") ?? "(empty response)"),
    route: normalizeRoute(pick(o, "route", "intent", "route_type", "classification")),
    verification: normalizeVerification(pick(o, "verification", "verification_status", "verdict", "self_correction")),
    sources: mapResults(pick(o, "sources", "citations", "context", "retrieved_chunks") ?? []),
    latencyMs: num(pick(o, "latency_ms")) ?? latencyMs,
    trace: mapTrace(o),
    raw: d,
  };
}

/* ---------- public API ---------- */
const demo = () => getSettings().mode === "demo";

export const api = {
  health: async (): Promise<HealthResult> => {
    try { const r = await request(ENDPOINTS.health); return { ok: true, latencyMs: r.latencyMs, data: r.data }; }
    catch (e) { return { ok: false, latencyMs: 0, error: (e as Error).message }; }
  },
  dbHealth: async (): Promise<HealthResult> => {
    try {
      const r = await request(ENDPOINTS.dbHealth);
      const st = isObj(r.data) ? String(r.data["status"] ?? "").toLowerCase() : "";
      return { ok: st === "connected" || st === "healthy" || st === "ok", latencyMs: r.latencyMs, data: r.data };
    } catch (e) { return { ok: false, latencyMs: 0, error: (e as Error).message }; }
  },

  documents: async (): Promise<DocumentRecord[]> => {
    if (demo()) return [];
    const r = await request<{ documents?: Obj[] } | Obj[]>("/documents");
    const list = Array.isArray(r.data) ? r.data : (r.data?.documents ?? []);
    return list.map((d) => ({
      id: String(d.id ?? ""),
      filename: String(d.filename ?? "unknown.pdf"),
      status: (String(d.status ?? "UPLOADED").toUpperCase() as DocStatus),
      fileType: String(d.file_type ?? d.fileType ?? "PDF"),
    }));
  },
  
  upload: (file: File, onProgress?: (pct: number) => void): Promise<unknown> => {
    if (demo()) {
      return new Promise((res) => { let p = 0; const iv = setInterval(() => { p += 20; onProgress?.(p); if (p >= 100) { clearInterval(iv); res({ demo: true, filename: file.name }); } }, 150); });
    }
    const { apiBaseUrl, timeoutMs } = getSettings();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiBaseUrl.replace(/\/$/, "") + ENDPOINTS.upload);
      xhr.timeout = timeoutMs;
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let d: unknown = xhr.responseText; try { d = JSON.parse(xhr.responseText); } catch { /* text */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(d);
        else reject(new ApiError(`${xhr.status} ${isObj(d) ? String(d["detail"] ?? "") : xhr.statusText}`, xhr.status));
      };
      xhr.onerror = () => reject(new ApiError("Backend unreachable"));
      xhr.ontimeout = () => reject(new ApiError("Upload timed out"));
      const fd = new FormData(); fd.append("file", file); xhr.send(fd);
    });
  },
  search: async (question: string, top_k: number): Promise<{ results: SearchResult[]; latencyMs: number; raw: unknown }> => {
    if (demo()) { const t = performance.now(); const results = await demoSearch(question, top_k); return { results, latencyMs: Math.round(performance.now() - t), raw: { demo: true } }; }
    const r = await request(ENDPOINTS.search, json({ question, top_k }));
    return { results: mapResults(r.data), latencyMs: r.latencyMs, raw: r.data };
  },
  ask: async (question: string, top_k: number, signal?: AbortSignal) => {
    const r = await request(ENDPOINTS.ask, json({ question, top_k }), signal);
    return mapAgent(r.data, r.latencyMs);
  },
  route: async (question: string) => {
    const r = await request(ENDPOINTS.route, json({ question }));
    return { route: normalizeRoute(isObj(r.data) ? pick(r.data, "route", "intent") : r.data), raw: r.data };
  },
  agent: async (question: string, top_k: number, signal?: AbortSignal): Promise<AgentResult> => {
    if (demo()) return demoAgent(question, top_k);
    const r = await request(ENDPOINTS.agent, json({ question, top_k }), signal);
    return mapAgent(r.data, r.latencyMs);
  },
};
