import { TABLES } from "./mock-data";

export const MAX_ROWS = 50;
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|replace|attach|pragma|exec|call|copy)\b/i;

export type SqlResult =
  | { ok: true; columns: string[]; rows: Record<string, unknown>[]; truncated: boolean; ms: number }
  | { ok: false; error: string; guardrail: string };

/** Guardrail validation. Returns an error message or null. */
export function checkGuardrails(sql: string): { error: string; guardrail: string } | null {
  const q = sql.trim().replace(/;+\s*$/, "");
  if (!q) return { error: "Empty query", guardrail: "syntax" };
  if (q.includes(";")) return { error: "Multiple statements are not allowed", guardrail: "single-statement" };
  if (/--|\/\*/.test(q)) return { error: "SQL comments are not allowed", guardrail: "no-comments" };
  if (!/^select\b/i.test(q)) return { error: "Only SELECT statements are permitted", guardrail: "read-only" };
  const bad = q.match(FORBIDDEN);
  if (bad) return { error: `Forbidden keyword: ${bad[0].toUpperCase()}`, guardrail: "read-only" };
  return null;
}

function cmp(a: unknown, op: string, b: string | number): boolean {
  const x = typeof a === "number" ? a : String(a).toLowerCase();
  const y = typeof a === "number" ? Number(b) : String(b).toLowerCase();
  switch (op) {
    case "=": return x === y;
    case "!=": case "<>": return x !== y;
    case ">": return x > y;
    case "<": return x < y;
    case ">=": return x >= y;
    case "<=": return x <= y;
  }
  return false;
}

/** Tiny read-only SQL engine: SELECT cols|agg FROM t [WHERE c op v [AND ...]] [GROUP BY c] [ORDER BY c [DESC]] [LIMIT n] */
export function runSql(sql: string): SqlResult {
  const t0 = performance.now();
  const g = checkGuardrails(sql);
  if (g) return { ok: false, ...g };
  const q = sql.trim().replace(/;+\s*$/, "");
  const m = q.match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+group\s+by\s+(\w+))?(?:\s+order\s+by\s+(\w+)(?:\s+(asc|desc))?)?(?:\s+limit\s+(\d+))?$/i);
  if (!m) return { ok: false, error: "Unsupported query shape", guardrail: "syntax" };
  const [, colsRaw, table, where, groupBy, orderBy, dir, limit] = m;
  const data = TABLES[table.toLowerCase()];
  if (!data) return { ok: false, error: `Unknown table '${table}' (allowed: ${Object.keys(TABLES).join(", ")})`, guardrail: "table-allowlist" };

  let rows = [...data];
  if (where) {
    const conds = where.split(/\s+and\s+/i);
    for (const c of conds) {
      const cm = c.trim().match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*('?)([^']*)\3$/);
      if (!cm) return { ok: false, error: `Unsupported WHERE clause: ${c}`, guardrail: "syntax" };
      const [, col, op, , val] = cm;
      rows = rows.filter((r) => cmp(r[col], op, val));
    }
  }

  const cols = colsRaw.split(",").map((s) => s.trim());
  const aggRe = /^(sum|count|avg|max|min)\((\*|\w+)\)(?:\s+as\s+(\w+))?$/i;
  const hasAgg = cols.some((c) => aggRe.test(c));
  if (hasAgg) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const k = groupBy ? String(r[groupBy]) : "_all";
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    rows = [...groups.values()].map((grp) => {
      const out: Record<string, unknown> = {};
      for (const c of cols) {
        const am = c.match(aggRe);
        if (!am) { out[c] = grp[0]?.[c]; continue; }
        const [, fn, field, alias] = am;
        const vals = grp.map((r) => Number(r[field] ?? 1));
        const name = alias ?? `${fn.toLowerCase()}_${field === "*" ? "all" : field}`;
        const f = fn.toLowerCase();
        out[name] = f === "count" ? grp.length : f === "sum" ? vals.reduce((a, b) => a + b, 0)
          : f === "avg" ? Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1))
          : f === "max" ? Math.max(...vals) : Math.min(...vals);
      }
      return out;
    });
  } else if (!(cols.length === 1 && cols[0] === "*")) {
    rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  }
  if (orderBy) {
    rows.sort((a, b) => {
      const x = a[orderBy] as number | string, y = b[orderBy] as number | string;
      return (x > y ? 1 : x < y ? -1 : 0) * (dir?.toLowerCase() === "desc" ? -1 : 1);
    });
  }
  const cap = Math.min(limit ? Number(limit) : MAX_ROWS, MAX_ROWS);
  const truncated = rows.length > cap;
  rows = rows.slice(0, cap);
  const columns = rows[0] ? Object.keys(rows[0]) : cols;
  return { ok: true, columns, rows, truncated, ms: Math.round(performance.now() - t0) + 3 };
}
