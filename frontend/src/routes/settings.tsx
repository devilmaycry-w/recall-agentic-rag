import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DEFAULT_API_BASE_URL, resetSettings, updateSettings, useSettings, type Settings } from "@/lib/config";
import { checkHealth } from "@/lib/health";
import { Btn, PageHeader, Panel, TopK } from "@/components/recall/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — RECALL" },
    { name: "description", content: "Configure RECALL API base URL, timeout, defaults and UI preferences." },
    { property: "og:title", content: "Settings — RECALL" },
    { property: "og:description", content: "Local configuration for the RECALL frontend." },
  ] }),
  component: SettingsPage,
});

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex border border-border font-mono text-[11px]">
      {options.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={cn("border-l border-border px-3 py-1.5 first:border-l-0", value === v ? "bg-primary text-primary-foreground" : "hover:text-primary")}>{l}</button>)}
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 py-4 last:border-0 md:flex-row md:items-center">
      <div className="md:w-64"><div className="font-mono text-xs uppercase">{label}</div>{hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}</div>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function SettingsPage() {
  const s = useSettings();
  const [url, setUrl] = useState(s.apiBaseUrl);
  const [timeout, setTimeoutV] = useState(String(s.timeoutMs / 1000));
  const [testing, setTesting] = useState(false);
  const save = (p: Partial<Settings>) => { updateSettings(p); toast.success("Setting saved"); };

  async function test() {
    setTesting(true);
    const r = await api.health();
    setTesting(false);
    r.ok ? toast.success(`Connected · ${r.latencyMs}ms`) : toast.error(r.error ?? "Connection failed");
    checkHealth();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Settings" subtitle="LOCAL CONFIGURATION // STORED IN BROWSER" />
      <Panel title="connection">
        <Field label="API Base URL" hint="Your FastAPI server">
          <input value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-0 flex-1 border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-primary" />
          <Btn variant="ghost" onClick={() => { try { new URL(url); save({ apiBaseUrl: url.replace(/\/$/, "") }); } catch { toast.error("Invalid URL"); } }}>SAVE</Btn>
          <Btn onClick={test} disabled={testing}>{testing ? "TESTING…" : "TEST CONNECTION"}</Btn>
        </Field>
        <Field label="Request Timeout" hint="Seconds before a request is cancelled">
          <input type="number" min={5} max={600} value={timeout} onChange={(e) => setTimeoutV(e.target.value)} className="w-24 border border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-primary" />
          <Btn variant="ghost" onClick={() => { const n = Number(timeout); if (!(n >= 5 && n <= 600)) { toast.error("Timeout must be 5–600 seconds"); return; } save({ timeoutMs: n * 1000 }); }}>SAVE</Btn>
        </Field>
        <Field label="Data Mode" hint="Demo uses labeled sample data; Backend calls FastAPI">
          <Seg value={s.mode} options={[["demo", "DEMO"], ["backend", "BACKEND"]]} onChange={(v) => save({ mode: v })} />
        </Field>
      </Panel>
      <Panel title="defaults">
        <Field label="Top-K Default" hint="Chunks retrieved per query"><TopK value={s.topK} onChange={(v) => save({ topK: v })} /></Field>
      </Panel>
      <Panel title="ui.theme">
        <Field label="Primary Accent"><Seg value={s.accent} options={[["acid", "ACID GREEN"], ["cyan", "ELECTRIC CYAN"]]} onChange={(v) => save({ accent: v })} /></Field>
        <Field label="Scanline Overlay"><Seg value={s.scanlines ? "on" : "off"} options={[["on", "ON"], ["off", "OFF"]]} onChange={(v) => save({ scanlines: v === "on" })} /></Field>
      </Panel>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>No API keys or secrets are stored. Default URL: {DEFAULT_API_BASE_URL}</span>
        <Btn variant="danger" onClick={() => { resetSettings(); setUrl(DEFAULT_API_BASE_URL); setTimeoutV("60"); toast("Settings reset"); }}>RESET</Btn>
      </div>
    </div>
  );
}
