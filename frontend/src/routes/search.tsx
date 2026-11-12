import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { api, type SearchResult } from "@/lib/api";
import { useSettings } from "@/lib/config";
import { Btn, Empty, PageHeader, Panel, Tag, TopK } from "@/components/recall/kit";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [
    { title: "Document Search — RECALL" },
    { name: "description", content: "Semantic retrieval across the RECALL pgvector knowledge base." },
    { property: "og:title", content: "Document Search — RECALL" },
    { property: "og:description", content: "Inspect retrieved chunks, pages and scores." },
  ] }),
  component: SearchPage,
});

function SearchPage() {
  const s = useSettings();
  const [q, setQ] = useState("");
  const [k, setK] = useState<3 | 5 | 10>(s.topK);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ q: string; k: number; results: SearchResult[]; latencyMs: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setErr(null);
    try { const r = await api.search(q.trim(), k); setRes({ q: q.trim(), k, ...r }); }
    catch (x) { setErr((x as Error).message); toast.error((x as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title="Document Search" subtitle="RETRIEVAL // POST /documents/search" right={s.mode === "demo" ? <Tag tone="warning">DEMO MODE</Tag> : undefined} />
      <form onSubmit={run} className="flex flex-wrap gap-2 border border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 border border-border bg-background px-3 focus-within:border-primary">
          <SearchIcon className="size-4 text-primary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the vector knowledge base..." className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/60" />
        </div>
        <TopK value={k} onChange={setK} />
        <Btn type="submit" disabled={loading || !q.trim()}>{loading ? "SEARCHING…" : "SEARCH"}</Btn>
      </form>

      {err && <div className="border border-error/60 bg-error/5 px-3 py-2 font-mono text-xs text-error">ERR: {err}</div>}
      {res && (
        <Panel title="retrieval.summary" tag={s.mode === "demo" ? "DEMO DATA" : undefined}>
          <pre className="font-mono text-[11px] leading-5 text-muted-foreground">
{`> query     : "${res.q}"
> top_k     : ${res.k}
> returned  : `}<span className="text-primary">{res.results.length} chunks</span>{`
> latency   : ${res.latencyMs}ms
> files     : ${[...new Set(res.results.map((r) => r.filename).filter(Boolean))].join(", ") || "—"}`}
          </pre>
        </Panel>
      )}
      {res ? (res.results.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {res.results.map((r, i) => (
            <article key={i} className="border border-border bg-card hover:border-primary/60">
              <header className="flex flex-wrap items-center gap-2 border-b border-border bg-elevated px-3 py-1.5 font-mono text-[10px]">
                <span className="text-primary">#{String(i + 1).padStart(2, "0")}</span>
                <span className="truncate text-cyan">{r.filename ?? "unnamed"}</span>
                {r.page !== undefined && <Tag>PAGE {r.page}</Tag>}
                {r.chunkIndex !== undefined && <Tag>CHUNK {r.chunkIndex}</Tag>}
                {r.score !== undefined && <Tag tone="primary" className="ml-auto">{r.scoreLabel} {r.score.toFixed(3)}</Tag>}
              </header>
              <p className="p-3 text-sm leading-relaxed text-foreground/90">{r.text || <span className="text-muted-foreground">(no text)</span>}</p>
            </article>
          ))}
        </div>
      ) : <Empty title="no matching chunks" hint="Try a broader query or upload more documents." />)
        : !err && <Empty title="enter a query to retrieve chunks" />}
    </div>
  );
}
