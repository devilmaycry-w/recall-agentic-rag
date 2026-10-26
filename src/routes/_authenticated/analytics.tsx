import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Locked, PageHeader } from "@/components/app-shell";
import { can, useStore } from "@/lib/store";
import { BENCHMARK, COST_LATENCY } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & Evals · Recall Agentic RAG" },
      { name: "description", content: "Query volume, latency, routing, abstention and retry analytics plus Naive vs Agentic RAG benchmarks." },
      { property: "og:title", content: "Analytics & Evals · Recall Agentic RAG" },
      { property: "og:description", content: "RAG analytics and Naive vs Agentic evaluation benchmarks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analytics,
});

const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, color: "var(--popover-foreground)" } };
const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };

function Analytics() {
  const { queries, role } = useStore();
  if (!can.viewAnalytics(role)) return <Locked need="Admin" />;

  const total = queries.length;
  const avg = Math.round(queries.reduce((a, q) => a + q.latencyMs, 0) / (total || 1));
  const abst = queries.filter((q) => q.verification === "Abstained").length;
  const corrected = queries.filter((q) => q.verification === "Corrected").length;
  const routes = ["Document Retrieval", "Read-Only SQL", "Clarification"].map((r) => ({ name: r, value: queries.filter((q) => q.route === r).length }));
  const retries = [0, 1, 2].map((n) => ({ retries: `${n} retries`, count: queries.filter((q) => q.retries === n).length }));
  const bench = BENCHMARK.map((b) => ({ metric: b.metric, "Naive RAG": b.naive, "Agentic RAG": b.agentic }));

  const kpis = [
    ["Total queries", total.toLocaleString(), "live · this tenant"],
    ["Avg latency", `${avg.toLocaleString()} ms`, "end-to-end p50"],
    ["Abstention rate", `${((abst / (total || 1)) * 100).toFixed(1)}%`, `${abst} abstained`],
    ["Self-corrected", `${((corrected / (total || 1)) * 100).toFixed(1)}%`, `${corrected} answers repaired`],
  ];

  return (
    <div>
      <PageHeader title="Analytics & Evaluation" subtitle="Updates live as you chat in this workspace" />
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(([l, v, s]) => (
            <div key={l} className="rounded border border-border bg-card p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">{v}</div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Tool routing breakdown">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={routes} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                  {routes.map((_, i) => <Cell key={i} fill={`var(--chart-${[2, 4, 3][i]})`} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
          <Panel title="Retry distribution">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={retries}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="retries" {...axis} />
                <YAxis {...axis} />
                <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        <Panel title="Benchmark: Naive RAG vs Agentic RAG" sub="Eval suite · 500 labeled Q&A pairs · RAGAS-style metrics (hallucination: lower is better)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bench}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="metric" {...axis} />
              <YAxis domain={[0, 1]} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Naive RAG" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Agentic RAG" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="font-mono text-[11px] text-muted-foreground"><tr><th className="py-1.5 text-left font-medium">Metric</th><th className="text-right font-medium">Naive</th><th className="text-right font-medium">Agentic</th><th className="text-right font-medium">Δ</th></tr></thead>
              <tbody className="font-mono text-xs">
                {BENCHMARK.map((b) => {
                  const d = b.agentic - b.naive;
                  const good = b.better === "higher" ? d > 0 : d < 0;
                  return <tr key={b.metric} className="border-t border-border"><td className="py-1.5 font-sans">{b.metric}</td><td className="text-right">{b.naive.toFixed(2)}</td><td className="text-right">{b.agentic.toFixed(2)}</td><td className={`text-right ${good ? "text-success" : "text-destructive"}`}>{d > 0 ? "+" : ""}{d.toFixed(2)}</td></tr>;
                })}
                {(() => { const [n, g] = [COST_LATENCY[0]!, COST_LATENCY[1]!]; return <>
                  <tr className="border-t border-border"><td className="py-1.5 font-sans">Latency (ms)</td><td className="text-right">{n.latency}</td><td className="text-right">{g.latency}</td><td className="text-right text-warning">+{g.latency - n.latency}</td></tr>
                  <tr className="border-t border-border"><td className="py-1.5 font-sans">Cost / query ($)</td><td className="text-right">{n.cost.toFixed(4)}</td><td className="text-right">{g.cost.toFixed(4)}</td><td className="text-right text-warning">+{(g.cost - n.cost).toFixed(4)}</td></tr>
                </>; })()}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>}
      <div className="mt-3">{children}</div>
    </div>
  );
}
