import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, PageHeader, Tag, Dot, connLabel } from "@/components/recall/kit";
import { api, type DocumentRecord } from "@/lib/api";
import { useHealth } from "@/lib/health";
import { useSettings } from "@/lib/config";
import { useSession } from "@/lib/session";
import { DEMO_ACTIVITY, DEMO_DOCUMENTS } from "@/lib/mock";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "System Overview — RECALL" },
    { name: "description", content: "RECALL agentic RAG system overview: documents, backend status and pipeline architecture." },
    { property: "og:title", content: "System Overview — RECALL" },
    { property: "og:description", content: "Agentic knowledge intelligence dashboard for local RAG." },
  ] }),
  component: Overview,
});

const PIPE = ["PDF INGESTION", "TEXT EXTRACTION", "CHUNKING", "EMBEDDING GENERATION", "PGVECTOR STORAGE", "AGENT ROUTER", "RETRIEVAL / SQL / CLARIFICATION", "LLM RESPONSE", "SELF-CORRECTION"];

function Kpi({ label, value, sub, tone = "text-foreground" }: { label: string; value: React.ReactNode; sub: string; tone?: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="label-mono">{label}</div>
      <div className={`mt-2 font-display text-3xl font-bold ${tone}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Overview() {
  const h = useHealth();
  const { mode } = useSettings();
  const s = useSession();
  const demo = mode === "demo";
  const [dbDocs, setDbDocs] = useState<DocumentRecord[] | null>(null);

  useEffect(() => {
    if (demo) {
      setDbDocs(null);
      return;
    }
    let active = true;
    api.documents()
      .then((list) => { if (active) setDbDocs(list); })
      .catch(() => { if (active) setDbDocs(null); });
    return () => { active = false; };
  }, [demo]);

  const docs = demo ? DEMO_DOCUMENTS : dbDocs;
  const count = (st?: string) => (docs ? docs.filter((d) => !st || d.status === st).length : "—");
  const src = demo ? "demo data" : dbDocs ? "via GET /documents" : "syncing…";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="System Overview" subtitle="RECALL // AGENTIC KNOWLEDGE INTELLIGENCE"
        right={<Tag tone={demo ? "warning" : "primary"}>{demo ? "DEMO MODE — sample data" : "BACKEND MODE"}</Tag>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total Documents" value={count()} sub={src} />
        <Kpi label="Processed" value={count("PROCESSED")} sub={src} tone="text-primary" />
        <Kpi label="Failed" value={count("FAILED")} sub={src} tone="text-error" />
        <Kpi label="Vector DB" value={<span className="flex items-center gap-2 text-base"><Dot s={h.db} />{connLabel(h.db)}</span>} sub="via /db-health" />
        <Kpi label="Backend" value={<span className="flex items-center gap-2 text-base"><Dot s={h.backend} />{connLabel(h.backend)}</span>} sub="via /health" />
        <Kpi label="Last Query Latency" value={s.lastLatency !== undefined ? `${s.lastLatency}ms` : "—"} sub={s.lastLatency !== undefined ? "this session" : "no queries yet"} tone="text-cyan" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="pipeline.architecture" className="lg:col-span-3">
          <div className="grid gap-0">
            {PIPE.map((p, i) => (
              <div key={p} className="flex items-stretch gap-3">
                <div className="flex w-6 flex-col items-center">
                  <span className={`mt-2 size-2.5 border ${i >= 5 ? "border-cyan bg-cyan/30" : "border-primary bg-primary/30"}`} />
                  {i < PIPE.length - 1 && <svg className="flex-1" width="2" height="100%" preserveAspectRatio="none" viewBox="0 0 2 10"><line x1="1" y1="0" x2="1" y2="10" stroke="var(--primary)" strokeWidth="2" className="flow-dash" /></svg>}
                </div>
                <div className="mb-1.5 flex flex-1 items-center justify-between border border-border bg-background px-3 py-1.5 font-mono text-xs hover:border-primary">
                  <span><span className="text-muted-foreground">{String(i + 1).padStart(2, "0")} </span>{p}</span>
                  <span className="text-[10px] text-muted-foreground">{i < 5 ? "INGEST" : "QUERY"}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-4 lg:col-span-2">
          <Panel title="activity.log" tag="DEMO DATA">
            <div className="space-y-1 font-mono text-[11px]">
              {DEMO_ACTIVITY.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{a.t}</span>
                  <span className={a.level === "WARN" ? "text-warning" : "text-primary"}>{a.level}</span>
                  <span className="truncate">{a.msg}</span>
                </div>
              ))}
              <div className="caret pt-1 text-muted-foreground">sample events — not live</div>
            </div>
          </Panel>
          <Panel title="quick.actions">
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {([["/assistant", "ASK AGENT"], ["/knowledge", "UPLOAD PDF"], ["/search", "VECTOR SEARCH"], ["/health", "DIAGNOSTICS"]] as const).map(([to, l]) => (
                <Link key={to} to={to} className="border border-border bg-background px-3 py-3 hover:border-primary hover:text-primary">{l} →</Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}