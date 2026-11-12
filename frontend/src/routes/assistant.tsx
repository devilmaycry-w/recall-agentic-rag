import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Square, Trash2, ChevronDown, FileText, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { session, useSession, type ChatMessage } from "@/lib/session";
import { useSettings } from "@/lib/config";
import { Btn, Panel, RouteBadge, VerifyBadge, Tag, TopK } from "@/components/recall/kit";
import { TraceList } from "@/components/recall/TraceList";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [
    { title: "AI Assistant — RECALL" },
    { name: "description", content: "Query your knowledge base through the RECALL agent with routing and self-correction." },
    { property: "og:title", content: "AI Assistant — RECALL" },
    { property: "og:description", content: "Agentic RAG chat console with citations and verification." },
  ] }),
  component: Assistant,
});

const EXAMPLES = ["What skills are listed in my resume?", "Summarize the uploaded document.", "How many documents are stored in the database?", "Which documents have failed processing?", "I need more context. Can you clarify?"];
const uid = () => Math.random().toString(36).slice(2, 10);

function AnswerCard({ m }: { m: ChatMessage }) {
  const [trace, setTrace] = useState(false);
  const r = m.result!;
  return (
    <div className="border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-elevated px-3 py-1.5">
        <span className="font-mono text-[10px] text-primary">RECALL://agent</span>
        <RouteBadge route={r.route} /><VerifyBadge v={r.verification} />
        <Tag>{r.latencyMs}ms</Tag>
        {m.demo && <Tag tone="warning">DEMO</Tag>}
      </div>
      <div className="whitespace-pre-wrap p-3 text-sm leading-relaxed">{r.answer}</div>
      <div className="border-t border-border px-3 py-2">
        <div className="label-mono mb-1">SOURCES [{r.sources.length}]</div>
        {r.sources.length ? (
          <div className="flex flex-wrap gap-1.5">
            {r.sources.map((s, i) => (
              <span key={i} title={s.text} className="inline-flex items-center gap-1 border border-cyan/50 px-1.5 py-0.5 font-mono text-[10px] text-cyan">
                <FileText className="size-3" />{s.filename ?? "unnamed"}{s.page !== undefined && ` · p.${s.page}`}
              </span>
            ))}
          </div>
        ) : <div className="font-mono text-[10px] text-muted-foreground">// no source documents returned</div>}
      </div>
      <button onClick={() => setTrace(!trace)} className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground hover:text-primary">
        <ChevronDown className={cn("size-3 transition-transform", trace && "rotate-180")} /> execution trace ({r.trace.length} steps)
      </button>
      {trace && <div className="border-t border-border p-3"><TraceList steps={r.trace} /></div>}
    </div>
  );
}

function Assistant() {
  const { messages, lastResult } = useSession();
  const settings = useSettings();
  const [input, setInput] = useState("");
  const [topK, setTopK] = useState<3 | 5 | 10>(settings.topK);
  const [loading, setLoading] = useState(false);
  const [side, setSide] = useState(true);
  const ctrl = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { setTopK(settings.topK); }, [settings.topK]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, loading]);

  async function send(q = input) {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");
    const demo = settings.mode === "demo";
    session.set((s) => ({ messages: [...s.messages, { id: uid(), role: "user", content: question }] }));
    setLoading(true);
    ctrl.current = new AbortController();
    try {
      const result = await api.agent(question, topK, ctrl.current.signal);
      if (ctrl.current.signal.aborted) throw new Error("Request cancelled");
      session.set((s) => ({ messages: [...s.messages, { id: uid(), role: "assistant", content: result.answer, result, question, demo }], lastResult: { question, result, demo }, lastLatency: result.latencyMs }));
    } catch (e) {
      const msg = (e as Error).message;
      session.set((s) => ({ messages: [...s.messages, { id: uid(), role: "error", content: msg }] }));
      if (msg !== "Request cancelled") toast.error(msg);
    } finally { setLoading(false); ctrl.current = null; }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-7xl gap-4 md:h-[calc(100vh-8rem)]">
      <div className="flex min-w-0 flex-1 flex-col border border-border bg-card/60">
        <div className="flex items-center justify-between border-b border-border bg-elevated px-3 py-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em]"><span className="text-primary">{">_"}</span> agent.session <span className="text-muted-foreground">→ POST /documents/agent</span></div>
          <div className="flex gap-2">
            <Btn variant="ghost" className="px-2 py-1" onClick={() => setSide(!side)} aria-label="Toggle panel"><PanelRight className="size-3.5" /></Btn>
            <Btn variant="ghost" className="px-2 py-1" disabled={!messages.length || loading} onClick={() => { session.set({ messages: [] }); toast("Conversation cleared"); }}><Trash2 className="size-3.5" /> CLEAR</Btn>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!messages.length && (
            <div className="mx-auto max-w-xl py-8">
              <div className="font-display text-xl font-bold uppercase">Query the knowledge core<span className="caret" /></div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">The agent routes your question to retrieval, SQL, or clarification, then self-verifies the answer.{settings.mode === "demo" && " [DEMO MODE: responses are sample data]"}</p>
              <div className="mt-5 grid gap-2">
                {EXAMPLES.map((e) => <button key={e} onClick={() => send(e)} className="border border-border bg-background px-3 py-2 text-left font-mono text-xs hover:border-primary hover:text-primary">$ {e}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] border border-primary/50 bg-primary/5 px-3 py-2 font-mono text-sm"><span className="text-primary">user@recall:~$ </span>{m.content}</div>
          ) : m.role === "error" ? (
            <div key={m.id} className="border border-error/60 bg-error/5 px-3 py-2 font-mono text-xs text-error">ERR: {m.content}</div>
          ) : <AnswerCard key={m.id} m={m} />)}
          {loading && <div className="font-mono text-xs text-primary">agent executing<span className="caret" /></div>}
          <div ref={end} />
        </div>
        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TopK value={topK} onChange={setTopK} />
            {messages.length > 0 && <select onChange={(e) => { if (e.target.value) send(e.target.value); e.target.value = ""; }} className="border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground" defaultValue=""><option value="">EXAMPLES…</option>{EXAMPLES.map((e) => <option key={e}>{e}</option>)}</select>}
            <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground sm:inline">ENTER send · SHIFT+ENTER newline</span>
          </div>
          <div className="flex gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Enter a query into the Recall knowledge system..."
              className="min-h-[52px] flex-1 resize-none border border-border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary" />
            {loading
              ? <Btn variant="danger" onClick={() => ctrl.current?.abort()}><Square className="size-3.5" /> STOP</Btn>
              : <Btn onClick={() => send()} disabled={!input.trim()}><Send className="size-3.5" /> SEND</Btn>}
          </div>
        </div>
      </div>

      {side && (
        <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto xl:flex">
          <Panel title="last.route">
            {lastResult ? <div className="space-y-2"><RouteBadge route={lastResult.result.route} /><div className="flex gap-2"><VerifyBadge v={lastResult.result.verification} /><Tag>{lastResult.result.latencyMs}ms</Tag></div><div className="font-mono text-[11px] text-muted-foreground">“{lastResult.question}”</div></div> : <div className="font-mono text-[11px] text-muted-foreground">// awaiting query</div>}
          </Panel>
          <Panel title="citations">
            {lastResult?.result.sources.length ? lastResult.result.sources.map((s, i) => (
              <div key={i} className="mb-2 border border-border bg-background p-2 font-mono text-[11px]">
                <div className="text-cyan">{s.filename ?? "unnamed"} {s.page !== undefined && `· p.${s.page}`}</div>
                <div className="mt-1 line-clamp-4 text-muted-foreground">{s.text}</div>
              </div>
            )) : <div className="font-mono text-[11px] text-muted-foreground">// no citations returned</div>}
          </Panel>
          <Panel title="agent.trace"><TraceList steps={lastResult?.result.trace ?? []} /></Panel>
        </aside>
      )}
    </div>
  );
}
