import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { checkHealth, useHealth, type Conn } from "@/lib/health";
import { ENDPOINTS, useSettings } from "@/lib/config";
import { Btn, Dot, PageHeader, Panel } from "@/components/recall/kit";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [
    { title: "System Health — RECALL" },
    { name: "description", content: "Diagnostics for the local FastAPI backend and PostgreSQL connection." },
    { property: "og:title", content: "System Health — RECALL" },
    { property: "og:description", content: "Local backend and database diagnostics." },
  ] }),
  component: Health,
});

function Row({ label, s, detail }: { label: string; s: Conn; detail: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 font-mono text-xs last:border-0">
      <Dot s={s} /><span className="flex-1">{label}</span>
      <span className="hidden text-[10px] text-muted-foreground md:inline">{detail}</span>
      <span className={s === "connected" ? "text-primary" : s === "disconnected" ? "text-error" : "text-muted-foreground"}>{s.toUpperCase()}</span>
    </div>
  );
}

function Health() {
  const h = useHealth();
  const { apiBaseUrl } = useSettings();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="System Health" subtitle="LOCAL DIAGNOSTICS"
        right={<Btn onClick={() => checkHealth()} disabled={h.checking}><RefreshCw className={h.checking ? "size-3.5 animate-spin" : "size-3.5"} /> {h.checking ? "CHECKING…" : "REFRESH"}</Btn>} />
      <Panel title="services">
        <Row label="FastAPI backend" s={h.backend} detail={`GET ${ENDPOINTS.health}`} />
        <Row label="PostgreSQL" s={h.db} detail={`GET ${ENDPOINTS.dbHealth}`} />
        <Row label="pgvector extension" s="unknown" detail="not reported by backend" />
        <Row label="Embedding service" s="unknown" detail="not reported by backend" />
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="api.latency"><div className="font-display text-3xl font-bold text-cyan">{h.backendRes?.ok ? `${h.backendRes.latencyMs}ms` : "—"}</div><div className="label-mono mt-1">/health round-trip</div></Panel>
        <Panel title="api.base_url"><div className="break-all font-mono text-sm text-primary">{apiBaseUrl}</div><div className="label-mono mt-1">configure in settings</div></Panel>
        <Panel title="last.check"><div className="font-mono text-sm">{h.checkedAt ? h.checkedAt.toLocaleTimeString() : "never"}</div><div className="label-mono mt-1">manual refresh only</div></Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {([["response /health", h.backendRes], ["response /db-health", h.dbRes]] as const).map(([t, r]) => (
          <Panel key={t} title={t}>
            <pre className="overflow-auto bg-background p-2 font-mono text-[11px] text-muted-foreground">{r ? (r.error ? `ERR: ${r.error}` : JSON.stringify(r.data, null, 2)) : "// not checked"}</pre>
          </Panel>
        ))}
      </div>
    </div>
  );
}
