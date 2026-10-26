import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { can, useStore, type Doc } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents · Recall Agentic RAG" },
      { name: "description", content: "Upload PDFs, text and Markdown, track ingestion, and inspect chunks and token counts." },
      { property: "og:title", content: "Documents · Recall Agentic RAG" },
      { property: "og:description", content: "Document ingestion, status tracking and chunk inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Documents,
});

const STATUS: Record<Doc["status"], string> = {
  Pending: "border-muted-foreground/30 text-muted-foreground",
  Processing: "border-info/40 bg-info/10 text-info",
  Indexed: "border-success/40 bg-success/10 text-success",
  Failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

interface ChunkRow { id: string; page: number; content: string; token_count: number }

function Documents() {
  const { docs, role, uploadFiles, retryDoc, deleteDoc, org } = useStore();
  const [drag, setDrag] = useState(false);
  const [inspect, setInspect] = useState<Doc | null>(null);
  const [chunks, setChunks] = useState<ChunkRow[]>([]);
  const [chunkCounts, setChunkCounts] = useState<Record<string, { n: number; tokens: number }>>({});
  const [uploading, setUploading] = useState(false);
  const allowed = can.upload(role);

  // Chunk counts per indexed document in this workspace.
  useEffect(() => {
    if (!org) return;
    supabase
      .from("document_chunks")
      .select("document_id, token_count")
      .eq("org_id", org.id)
      .then(({ data }) => {
        const counts: Record<string, { n: number; tokens: number }> = {};
        for (const c of data ?? []) {
          const entry = (counts[c.document_id] ??= { n: 0, tokens: 0 });
          entry.n += 1;
          entry.tokens += c.token_count;
        }
        setChunkCounts(counts);
      });
  }, [org, docs]);

  // Load chunks when the inspector opens.
  useEffect(() => {
    if (!inspect) { setChunks([]); return; }
    supabase
      .from("document_chunks")
      .select("id, page, content, token_count")
      .eq("document_id", inspect.id)
      .order("page", { ascending: true })
      .then(({ data }) => setChunks(data ?? []));
  }, [inspect]);

  const accept = async (files: FileList | null) => {
    if (!files) return;
    const ok = [...files].filter((f) => /\.(pdf|txt|md|markdown)$/i.test(f.name));
    if (!ok.length) return;
    setUploading(true);
    try { await uploadFiles(ok); } finally { setUploading(false); }
  };

  const counts = (["Pending", "Processing", "Indexed", "Failed"] as Doc["status"][]).map((s) => [s, docs.filter((d) => d.status === s).length] as const);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Ingestion pipeline: parse → chunk → embed → index" />
      <div className="space-y-6 p-6">
        <label
          onDragOver={(e) => { e.preventDefault(); if (allowed) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (allowed) void accept(e.dataTransfer.files); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/40", (!allowed || uploading) && "cursor-not-allowed opacity-50")}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <div className="mt-2 text-sm font-medium">
            {uploading ? "Uploading and indexing…" : allowed ? "Drop PDF, TXT or Markdown files, or click to browse" : "Uploading requires Admin or Knowledge Manager"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">chunk size ~180 tokens · embedding: text-embedding (1536d) · stored in your workspace only</div>
          <input type="file" multiple accept=".pdf,.txt,.md,.markdown" className="hidden" disabled={!allowed || uploading} onChange={(e) => { void accept(e.target.files); e.target.value = ""; }} />
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map(([s, n]) => (
            <div key={s} className="rounded border border-border bg-card p-3">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">{s}</div>
              <div className="mt-1 text-2xl font-semibold">{n}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card font-mono text-[11px] text-muted-foreground">
              <tr><th className="px-3 py-2 text-left font-medium">Name</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-left font-medium">Chunks</th><th className="px-3 py-2 text-left font-medium">Uploaded</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const cc = chunkCounts[d.id];
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect(d)} className="flex items-center gap-2 text-left hover:text-primary">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{d.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{d.type} · {d.sizeKb.toLocaleString()}KB</span>
                      </button>
                      {d.error && <div className="ml-6 mt-0.5 font-mono text-[11px] text-destructive">{d.error}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase", STATUS[d.status])}>
                          {d.status === "Processing" && <Loader2 className="h-3 w-3 animate-spin" />}{d.status}
                        </span>
                        {d.status !== "Indexed" && (
                          <span className="h-1 w-16 overflow-hidden rounded bg-muted"><span className={cn("block h-full", d.status === "Failed" ? "bg-destructive" : "bg-info")} style={{ width: `${d.progress}%` }} /></span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{d.status === "Indexed" && cc ? `${cc.n} · ${cc.tokens} tok` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{d.uploadedAt}<br />{d.uploadedBy}</td>
                    <td className="px-3 py-2.5 text-right">
                      {allowed && d.status === "Failed" && <button onClick={() => void retryDoc(d.id)} aria-label="Retry" className="rounded p-1.5 hover:bg-accent"><RotateCcw className="h-4 w-4" /></button>}
                      {allowed && <button onClick={() => void deleteDoc(d.id)} aria-label="Delete" className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && (
                <tr className="border-t border-border"><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">No documents yet — upload your first file above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inspect && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-background/70" onClick={() => setInspect(null)} />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-popover">
            <div className="flex items-start justify-between border-b border-border p-4">
              <div>
                <div className="font-mono text-[10px] uppercase text-muted-foreground">Chunk inspector</div>
                <div className="mt-1 font-semibold">{inspect.name}</div>
              </div>
              <button onClick={() => setInspect(null)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {chunks.map((c) => (
                <div key={c.id} className="rounded border border-border bg-card p-3">
                  <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                    <span>{c.id.slice(0, 8)}</span><span>page {c.page} · {c.token_count} tokens</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{c.content}</p>
                </div>
              ))}
              {chunks.length === 0 && <p className="text-sm text-muted-foreground">No chunks — ingestion did not complete.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
