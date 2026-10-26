import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { SCHEMA } from "@/lib/mock-data";
import { MAX_ROWS, runSql, type SqlResult } from "@/lib/sql";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/sql")({
  head: () => ({
    meta: [
      { title: "SQL Tool · Recall Agentic RAG" },
      { name: "description", content: "Read-only SQL tool the agent uses over sales and inventory data, with strict guardrails." },
      { property: "og:title", content: "SQL Tool · Recall Agentic RAG" },
      { property: "og:description", content: "Guardrailed read-only SQL over structured business data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SqlPage,
});

const EXAMPLES = [
  "SELECT region, sum(revenue) as revenue FROM sales WHERE quarter = '2026-Q3' GROUP BY region ORDER BY revenue DESC",
  "SELECT * FROM inventory WHERE on_hand < 30 ORDER BY on_hand",
  "SELECT product, avg(units) as avg_units FROM sales GROUP BY product",
  "DELETE FROM sales WHERE region = 'EMEA'",
  "SELECT * FROM sales; DROP TABLE sales",
];

const RULES = ["SELECT statements only", "Single statement, no comments", "Table allow-list: sales, inventory", `Row cap: ${MAX_ROWS}`, "Read replica, 2s timeout", "Tenant-scoped connection"];

function SqlPage() {
  const { log } = useStore();
  const [q, setQ] = useState(EXAMPLES[0]!);
  const [res, setRes] = useState<SqlResult | null>(null);
  const run = (sql: string = q) => {
    setQ(sql);
    const r = runSql(sql);
    setRes(r);
    log(r.ok ? "sql.query" : "sql.blocked", sql.slice(0, 80));
  };

  return (
    <div>
      <PageHeader title="Read-Only SQL Tool" subtitle="The structured-data tool the agent routes numeric questions to" />
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <div className="rounded border border-input bg-card">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={4} spellCheck={false} className="w-full resize-y bg-transparent p-3 font-mono text-xs outline-none" />
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="font-mono text-[10px] text-muted-foreground">⌘ executes against tenant read replica</span>
              <button onClick={() => run()} className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"><Play className="h-3.5 w-3.5" /> Run</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => <button key={e} onClick={() => run(e)} className="max-w-full truncate rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground">{e}</button>)}
          </div>
          {res && !res.ok && (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <div><div className="font-medium">Blocked by guardrail: {res.guardrail}</div><div className="font-mono text-xs">{res.error}</div></div>
            </div>
          )}
          {res && res.ok && (
            <div className="overflow-hidden rounded border border-border">
              <div className="flex justify-between bg-card px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                <span>{res.rows.length} rows{res.truncated && ` (capped at ${MAX_ROWS})`}</span><span>{res.ms}ms</span>
              </div>
              <div className="max-h-[460px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted"><tr>{res.columns.map((c) => <th key={c} className="px-3 py-1.5 text-left font-mono font-medium">{c}</th>)}</tr></thead>
                  <tbody>{res.rows.map((r, i) => <tr key={i} className="border-t border-border">{res.columns.map((c) => <td key={c} className="px-3 py-1.5 font-mono">{typeof r[c] === "number" ? (r[c] as number).toLocaleString() : String(r[c])}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck className="h-4 w-4 text-success" /> Guardrails</div>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">{RULES.map((r) => <li key={r}>✓ {r}</li>)}</ul>
          </div>
          {Object.entries(SCHEMA).map(([t, cols]) => (
            <div key={t} className="rounded border border-border bg-card p-3">
              <div className="font-mono text-xs font-semibold text-primary">{t}</div>
              <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">{cols.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
