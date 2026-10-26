import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, ChevronDown, ChevronRight, CircleCheck, CircleSlash, Database, FileText, HelpCircle, Loader2, RotateCcw, ThumbsDown, ThumbsUp, TriangleAlert, Workflow } from "lucide-react";
import { toast } from "sonner";
import { runAgent, type AgentAnswer, type Citation, type RouteKind } from "@/lib/agent";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistant · Recall Agentic RAG" },
      { name: "description", content: "Ask questions over your organization's knowledge with routed, cited, self-verified answers." },
      { property: "og:title", content: "Assistant · Recall Agentic RAG" },
      { property: "og:description", content: "Routed, cited, self-verified answers over organizational knowledge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

interface Msg { id: string; role: "user" | "assistant"; text: string; answer?: AgentAnswer; pending?: boolean }

const SUGGESTIONS = [
  "How many days of PTO do employees accrue per month?",
  "What is the maximum payload of the R-200?",
  "Show Q3 revenue by region",
  "Which inventory items are below reorder point?",
  "What is our policy on quantum teleportation?",
  "help",
];

function Chat() {
  const { docs, org, recordQuery } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMsgs([]); }, [org.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const busy = msgs.some((m) => m.pending);
  const send = (q: string) => {
    if (!q.trim() || busy) return;
    const id = crypto.randomUUID();
    setMsgs((m) => [...m, { id: id + "u", role: "user", text: q }, { id, role: "assistant", text: "", pending: true }]);
    setInput("");
    const answer = runAgent(q, docs);
    setTimeout(() => {
      setMsgs((m) => m.map((x) => (x.id === id ? { ...x, pending: false, text: answer.content, answer } : x)));
      const v = answer.verification;
      recordQuery({ orgId: org.id, route: answer.route, latencyMs: answer.latencyMs, verification: v.kind, retries: v.kind === "Corrected" ? v.retry : v.kind === "Abstained" ? 2 : 0 });
    }, Math.min(2200, 600 + answer.latencyMs / 2));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {msgs.length === 0 && (
            <div className="pt-10">
              <div className="font-mono text-xs text-primary">// {org.name}</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Ask your organization's knowledge.</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">Every answer is routed to the right tool, graded for relevance, and checked for groundedness before you see it. If the evidence isn't there, the assistant says so.</p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded border border-border bg-card px-3 py-2.5 text-left text-sm text-card-foreground transition-colors hover:border-primary/50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-6">
            {msgs.map((m) => m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-lg bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">{m.text}</div>
              </div>
            ) : (
              <AssistantMessage key={m.id} msg={m} />
            ))}
          </div>
          <div ref={endRef} />
        </div>
      </div>
      <div className="border-t border-border bg-background px-4 py-3">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-input bg-card p-2 focus-within:border-primary/60">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Ask about policies, product specs, or sales numbers…"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded bg-primary text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
        <p className="mx-auto mt-1.5 max-w-3xl font-mono text-[10px] text-muted-foreground">Prototype · simulated agent · answers drawn from {docs.filter((d) => d.status === "Indexed").length} indexed documents in this workspace only</p>
      </div>
    </div>
  );
}

const ROUTE_STYLE: Record<RouteKind, { icon: typeof FileText; cls: string }> = {
  "Document Retrieval": { icon: FileText, cls: "border-info/40 bg-info/10 text-info" },
  "Read-Only SQL": { icon: Database, cls: "border-chart-4/40 bg-chart-4/10 text-chart-4" },
  Clarification: { icon: HelpCircle, cls: "border-warning/40 bg-warning/10 text-warning" },
};

function VerificationBadge({ v }: { v: AgentAnswer["verification"] }) {
  if (v.kind === "Grounded") return <Tag cls="border-success/40 bg-success/10 text-success" icon={CircleCheck}>Grounded</Tag>;
  if (v.kind === "Corrected") return <Tag cls="border-warning/40 bg-warning/10 text-warning" icon={RotateCcw}>Corrected (Retry {v.retry}/{v.max})</Tag>;
  return <Tag cls="border-destructive/40 bg-destructive/10 text-destructive" icon={CircleSlash}>Abstained · Insufficient Evidence</Tag>;
}

function Tag({ cls, icon: Icon, children }: { cls: string; icon: typeof FileText; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", cls)}><Icon className="h-3 w-3" />{children}</span>;
}

function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*|\[\d\])/g).map((p, i) =>
    p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong>
    : /^\[\d\]$/.test(p) ? <sup key={i} className="ml-0.5 font-mono text-[10px] text-primary">{p}</sup>
    : p,
  );
}

function AssistantMessage({ msg }: { msg: Msg }) {
  const [trace, setTrace] = useState(false);
  const [openCite, setOpenCite] = useState<number | null>(null);
  const [fb, setFb] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const { log } = useStore();

  if (msg.pending) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> routing → retrieving → grading → verifying…
      </div>
    );
  }
  const a = msg.answer!;
  const R = ROUTE_STYLE[a.route];
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary/15 font-mono text-[11px] font-bold text-primary">≡R</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag cls={R.cls} icon={R.icon}>{a.route}</Tag>
          <VerificationBadge v={a.verification} />
          <span className="font-mono text-[10px] text-muted-foreground">{a.latencyMs}ms</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{renderText(a.content)}</p>

        {a.sql && (
          <div className="mt-3 overflow-hidden rounded border border-border">
            <pre className="overflow-x-auto bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">{a.sql.query}</pre>
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-card"><tr>{a.sql.columns.map((c) => <th key={c} className="px-3 py-1.5 text-left font-mono font-medium text-muted-foreground">{c}</th>)}</tr></thead>
                <tbody>{a.sql.rows.map((r, i) => <tr key={i} className="border-t border-border">{a.sql!.columns.map((c) => <td key={c} className="px-3 py-1.5 font-mono">{typeof r[c] === "number" ? (r[c] as number).toLocaleString() : String(r[c])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {a.citations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {a.citations.map((c, i) => <CitationRow key={c.chunkId} c={c} i={i} open={openCite === i} toggle={() => setOpenCite(openCite === i ? null : i)} />)}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <button onClick={() => setTrace(!trace)} className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground">
            <Workflow className="h-3.5 w-3.5" /> reasoning trace ({a.trace.length})
            {trace ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button aria-label="Helpful" onClick={() => { setFb("up"); setSent(false); }} className={cn("rounded p-1.5 hover:bg-accent", fb === "up" && "text-success")}><ThumbsUp className="h-3.5 w-3.5" /></button>
            <button aria-label="Not helpful" onClick={() => { setFb("down"); setSent(false); }} className={cn("rounded p-1.5 hover:bg-accent", fb === "down" && "text-destructive")}><ThumbsDown className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {fb && !sent && (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); log(`feedback.${fb}`, comment || "(no comment)"); toast.success("Feedback recorded — thanks!"); }} className="mt-2 flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={fb === "up" ? "What was helpful? (optional)" : "What went wrong?"} className="flex-1 rounded border border-input bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary/60" />
            <button className="rounded bg-primary px-3 text-xs font-medium text-primary-foreground">Submit</button>
          </form>
        )}

        {trace && (
          <ol className="mt-2 space-y-0 rounded border border-border bg-card p-3">
            {a.trace.map((s, i) => (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                {i < a.trace.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border" />}
                <span className={cn("mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                  s.status === "ok" ? "border-success bg-success/30" : s.status === "warn" ? "border-warning bg-warning/30" : s.status === "fail" ? "border-destructive bg-destructive/30" : "border-muted-foreground/40")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-medium", s.status === "skip" && "text-muted-foreground")}>{s.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{s.ms ? `${s.ms}ms` : "—"}</span>
                  </div>
                  <div className="break-words font-mono text-[11px] text-muted-foreground">{s.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {a.verification.kind === "Abstained" && (
          <div className="mt-2 flex items-start gap-2 rounded border border-warning/30 bg-warning/5 p-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-warning" /> The agent abstained rather than risk a hallucinated answer.
          </div>
        )}
      </div>
    </div>
  );
}

function CitationRow({ c, i, open, toggle }: { c: Citation; i: number; open: boolean; toggle: () => void }) {
  return (
    <div className="rounded border border-border bg-card">
      <button onClick={toggle} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs">
        <span className="font-mono text-primary">[{i + 1}]</span>
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate font-medium">{c.docName}</span>
        <span className="font-mono text-muted-foreground">p.{c.page}</span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="h-1 w-12 overflow-hidden rounded bg-muted"><span className="block h-full bg-primary" style={{ width: `${c.confidence * 100}%` }} /></span>
          {(c.confidence * 100).toFixed(0)}%
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5">
          <blockquote className="border-l-2 border-primary pl-3 text-xs leading-relaxed">{c.snippet}</blockquote>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">chunk {c.chunkId} · confidence {c.confidence.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
