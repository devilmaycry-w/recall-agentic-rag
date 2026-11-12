import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { demoAgent } from "@/lib/mock";
import type { AgentResult, Route as R } from "@/lib/api";
import { Btn, PageHeader, Panel, RouteBadge, Tag, VerifyBadge } from "@/components/recall/kit";
import { TraceList } from "@/components/recall/TraceList";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trace")({
  head: () => ({ meta: [
    { title: "Agent Trace — RECALL" },
    { name: "description", content: "Inspect RECALL agent execution: intent classification, routing and self-correction." },
    { property: "og:title", content: "Agent Trace — RECALL" },
    { property: "og:description", content: "Execution timeline for the RECALL agent." },
  ] }),
  component: Trace,
});

const ROUTES: R[] = ["DOCUMENT_SEARCH", "SQL_QUERY", "CLARIFICATION", "GENERAL"];

function Trace() {
  const { lastResult } = useSession();
  const [sample, setSample] = useState<{ q: string; r: AgentResult } | null>(null);
  const live = lastResult && !lastResult.demo ? lastResult : null;
  const view = live ? { q: live.question, r: live.result, demo: false } : lastResult ? { q: lastResult.question, r: lastResult.result, demo: true } : sample ? { ...sample, demo: true } : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="Agent Trace" subtitle="EXECUTION MONITOR // LAST AGENT RUN"
        right={view ? <Tag tone={view.demo ? "warning" : "primary"}>{view.demo ? "DEMO TRACE" : "BACKEND TRACE"}</Tag> : undefined} />
      <Panel title="route.flow">
        <svg viewBox="0 0 800 150" className="w-full font-mono">
          <rect x="10" y="55" width="130" height="40" fill="none" stroke="var(--primary)" />
          <text x="75" y="80" textAnchor="middle" fontSize="11" fill="var(--foreground)">QUERY</text>
          <line x1="140" y1="75" x2="250" y2="75" stroke="var(--primary)" className="flow-dash" />
          <rect x="250" y="55" width="140" height="40" fill="none" stroke="var(--cyan)" />
          <text x="320" y="80" textAnchor="middle" fontSize="11" fill="var(--foreground)">INTENT ROUTER</text>
          {ROUTES.map((r, i) => {
            const y = 12 + i * 36, on = view?.r.route === r;
            return (
              <g key={r}>
                <line x1="390" y1="75" x2="520" y2={y + 13} stroke={on ? "var(--primary)" : "var(--border)"} className={on ? "flow-dash" : ""} />
                <rect x="520" y={y} width="160" height="26" fill={on ? "color-mix(in oklab, var(--primary) 15%, transparent)" : "none"} stroke={on ? "var(--primary)" : "var(--border)"} />
                <text x="600" y={y + 17} textAnchor="middle" fontSize="10" fill={on ? "var(--primary)" : "var(--muted-foreground)"}>{r}</text>
                <line x1="680" y1={y + 13} x2="720" y2="75" stroke={on ? "var(--primary)" : "var(--border)"} />
              </g>
            );
          })}
          <rect x="720" y="60" width="70" height="30" fill="none" stroke="var(--primary)" />
          <text x="755" y="79" textAnchor="middle" fontSize="10" fill="var(--foreground)">VERIFY</text>
        </svg>
      </Panel>
      {view ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="run.summary" tag={view.demo ? "DEMO DATA" : undefined}>
            <div className="space-y-3 font-mono text-xs">
              <div><div className="label-mono">QUERY</div><div className="mt-1">“{view.q}”</div></div>
              <div><div className="label-mono mb-1">ROUTE</div><RouteBadge route={view.r.route} /></div>
              <div><div className="label-mono mb-1">VERIFICATION</div><VerifyBadge v={view.r.verification} /></div>
              <div><div className="label-mono">TOTAL LATENCY</div><div className="mt-1 text-cyan">{view.r.latencyMs}ms</div></div>
            </div>
          </Panel>
          <Panel title="execution.timeline" className="lg:col-span-2"><TraceList steps={view.r.trace} /></Panel>
          <Panel title="raw.response" className="lg:col-span-3">
            <pre className={cn("max-h-72 overflow-auto bg-background p-2 font-mono text-[10px] text-muted-foreground")}>{JSON.stringify(view.r.raw, null, 2)}</pre>
          </Panel>
        </div>
      ) : (
        <div className="border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
          // no agent runs yet this session
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/assistant" className="border border-primary bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground">RUN A QUERY</Link>
            <Btn variant="ghost" onClick={async () => setSample({ q: "What skills are listed in my resume?", r: await demoAgent("What skills are listed in my resume?", 5) })}>LOAD SAMPLE TRACE</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
