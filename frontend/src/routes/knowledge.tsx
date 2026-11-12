import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, RefreshCw, FileText, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { api, type DocStatus, type DocumentRecord } from "@/lib/api";
import { MAX_UPLOAD_BYTES, useSettings } from "@/lib/config";
import { DEMO_DOCUMENTS } from "@/lib/mock";
import { session, useSession } from "@/lib/session";
import { Btn, DocBadge, Empty, PageHeader, Panel, Tag } from "@/components/recall/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/knowledge")({
  head: () => ({ meta: [
    { title: "Knowledge Base — RECALL" },
    { name: "description", content: "Upload PDF documents into the RECALL knowledge core." },
    { property: "og:title", content: "Knowledge Base — RECALL" },
    { property: "og:description", content: "PDF ingestion and document management for local RAG." },
  ] }),
  component: Knowledge,
});

const fmt = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`);

function Knowledge() {
  const { mode } = useSettings();
  const { uploads } = useSession();
  const demo = mode === "demo";
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DocStatus | "ALL">("ALL");
  const [dbDocs, setDbDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async (showToast = false) => {
    if (demo) return;
    setLoading(true);
    setFetchError(null);
    try {
      const list = await api.documents();
      setDbDocs(list);
      if (showToast) toast.success("Document index refreshed");
    } catch (e) {
      const msg = (e as Error).message;
      setFetchError(msg);
      if (showToast) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function pick(f?: File) {
    setResult(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { toast.error("Only PDF files are supported"); return; }
    if (f.size > MAX_UPLOAD_BYTES) { toast.error(`File exceeds 20 MB (${fmt(f.size)})`); return; }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setProgress(0);
    try {
      const res = await api.upload(file, setProgress);
      const r = (res ?? {}) as Record<string, unknown>;
      const id = String(r["document_id"] ?? r["id"] ?? (demo ? `demo-${Date.now().toString(36)}` : "—"));
      const st = String(r["status"] ?? "UPLOADED").toUpperCase();
      const rec: DocumentRecord = { id, filename: file.name, fileType: "PDF", status: (["UPLOADED", "PROCESSING", "PROCESSED", "FAILED"].includes(st) ? st : "UPLOADED") as DocStatus };
      session.set((s) => ({ uploads: [rec, ...s.uploads] }));
      setResult({ ok: true, msg: `${file.name} uploaded${demo ? " (demo — not sent to backend)" : ""}` });
      toast.success("Upload complete");
      setFile(null);
      if (!demo) await loadDocuments();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
      toast.error((e as Error).message);
    } finally { setProgress(null); }
  }

  const rows = useMemo(() => {
    if (demo) {
      const base = [...uploads, ...DEMO_DOCUMENTS];
      return base.filter((d) => (filter === "ALL" || d.status === filter) && d.filename.toLowerCase().includes(q.toLowerCase()));
    }
    const merged = new Map<string, DocumentRecord>();
    for (const d of dbDocs) merged.set(d.id, d);
    for (const u of uploads) if (!merged.has(u.id)) merged.set(u.id, u);
    return Array.from(merged.values()).filter(
      (d) => (filter === "ALL" || d.status === filter) && d.filename.toLowerCase().includes(q.toLowerCase())
    );
  }, [dbDocs, uploads, demo, filter, q]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader title="Knowledge Base" subtitle="INGESTION // POST /documents/upload" right={demo ? <Tag tone="warning">DEMO MODE</Tag> : undefined} />
      <Panel title="upload.pdf">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          className={cn("grid place-items-center border-2 border-dashed px-4 py-10 text-center transition-colors", drag ? "border-primary bg-primary/5" : "border-border")}>
          <Upload className={cn("mb-3 size-8", drag ? "text-primary" : "text-muted-foreground")} />
          <div className="font-display text-lg font-bold uppercase tracking-tight">Drop documents into the knowledge core</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">PDF ONLY · MAX 20 MB</div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <Btn variant="ghost" className="mt-4" onClick={() => inputRef.current?.click()}>SELECT PDF</Btn>
        </div>
        {file && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border border-border bg-background p-3 font-mono text-xs">
            <FileText className="size-4 text-cyan" /><span className="flex-1 truncate">{file.name}</span><span className="text-muted-foreground">{fmt(file.size)}</span>
            {progress === null && <button onClick={() => setFile(null)} aria-label="Remove"><X className="size-4" /></button>}
            <Btn onClick={upload} disabled={progress !== null}>{progress !== null ? "UPLOADING…" : "UPLOAD"}</Btn>
          </div>
        )}
        {progress !== null && (
          <div className="mt-2 border border-border p-1"><div className="h-2 bg-primary transition-all" style={{ width: `${progress}%` }} /><div className="mt-1 font-mono text-[10px] text-muted-foreground">{progress}%</div></div>
        )}
        {result && <div className={cn("mt-3 border px-3 py-2 font-mono text-xs", result.ok ? "border-primary/60 text-primary" : "border-error/60 text-error")}>{result.ok ? "OK: " : "ERR: "}{result.msg}</div>}
      </Panel>

      <Panel title="documents.index" tag={demo ? "DEMO DATA" : undefined}
        right={
          <Btn variant="ghost" className="px-2 py-1" disabled={loading} onClick={() => loadDocuments(true)}>
            <RefreshCw className={cn("size-3", loading && "animate-spin")} /> {loading ? "SYNCING…" : "REFRESH"}
          </Btn>
        }>
        {fetchError && (
          <div className="mb-3 border border-error/60 bg-error/5 px-3 py-2 font-mono text-[11px] text-error">
            ERR: {fetchError}
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search filename…" className="min-w-0 flex-1 border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-primary" />
          <select value={filter} onChange={(e) => setFilter(e.target.value as DocStatus | "ALL")} className="border border-border bg-background px-2 py-1.5 font-mono text-xs">
            {["ALL", "UPLOADED", "PROCESSING", "PROCESSED", "FAILED"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead><tr className="border-b border-border text-left">{["Filename", "Document ID", "Status", "File Type", "Actions"].map((h) => <th key={h} className="label-mono px-2 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 hover:bg-elevated">
                    <td className="px-2 py-2">{d.filename}</td>
                    <td className="px-2 py-2 text-muted-foreground">{d.id}</td>
                    <td className="px-2 py-2"><DocBadge s={d.status} /></td>
                    <td className="px-2 py-2 text-muted-foreground">{d.fileType}</td>
                    <td className="px-2 py-2"><button className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary" onClick={() => { navigator.clipboard.writeText(d.id); toast.success("Document ID copied"); }}><Copy className="size-3" /> COPY ID</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty title={q || filter !== "ALL" ? "no documents match filters" : "no documents found"} hint={!demo ? "Upload a PDF above to populate the knowledge core." : undefined} />}
      </Panel>
    </div>
  );
}