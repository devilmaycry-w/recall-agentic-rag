import { createFileRoute } from "@tanstack/react-router";
import { Locked, PageHeader } from "@/components/app-shell";
import { can, useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · Recall Agentic RAG" },
      { name: "description", content: "Tenant-scoped audit trail of uploads, queries, role changes and blocked actions." },
      { property: "og:title", content: "Audit Log · Recall Agentic RAG" },
      { property: "og:description", content: "Tenant-scoped audit trail for the knowledge workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { audit, role, org } = useStore();
  if (!can.viewAudit(role)) return <Locked need="Admin" />;
  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`All events scoped to ${org.id}`} />
      <div className="p-6">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-card font-mono text-[11px] text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Time (UTC)</th><th className="px-3 py-2 text-left font-medium">Actor</th><th className="px-3 py-2 text-left font-medium">Action</th><th className="px-3 py-2 text-left font-medium">Target</th></tr></thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{a.at}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.actor}</td>
                  <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${/blocked|failed/.test(a.action) ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}>{a.action}</span></td>
                  <td className="px-3 py-2 text-xs">{a.target}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">No events yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
