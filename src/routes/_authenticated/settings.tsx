import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { BackendStatus } from "@/components/backend-status";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { curlExample, fastApiExample } from "@/lib/backend";
import { AI_PROVIDERS, AI_PROVIDER_IDS, type AiProviderId } from "@/lib/ai-providers";
import { clearOrgAiSettings, getOrgAiSettings, saveOrgAiSettings } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Backend Settings · Recall" },
    { name: "description", content: "Configure a local FastAPI or Ollama RAG backend for the Recall assistant." },
    { property: "og:title", content: "Backend Settings · Recall" },
    { property: "og:description", content: "Connect and check your local knowledge assistant backend." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Settings,
});

function Settings() {
  const { org, backend } = useStore();
  const { settings, setSettings, ready, connection, healthCheck, storageError } = backend;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  let curl = "Enter a valid backend URL to generate the command.";
  try { curl = curlExample(settings, org?.id ?? ""); } catch { /* Invalid URL is reported by the health check. */ }
  const spec = fastApiExample(origin);
  const copy = async (text: string, name: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(name); toast.success(`${name} copied`); }
    catch { toast.error("Clipboard unavailable. Select and copy the example below."); }
  };
  return <div>
    <PageHeader title="Backend Connection & Local LLM" right={<BackendStatus />} />
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <section className="space-y-5">
        <h2 className="text-base font-semibold">Connection</h2>
        <div>
          <label htmlFor="backend-mode" className="mb-2 block text-sm font-medium">Mode</label>
          <select id="backend-mode" disabled={!ready} value={settings.mode} onChange={(e) => setSettings({ ...settings, mode: e.target.value === "custom" ? "custom" : "simulated" })} className="w-full rounded border border-input bg-card px-3 py-2 text-sm">
            <option value="simulated">Simulated (Built-in Demo)</option>
            <option value="custom">Custom / Local Backend (FastAPI / Ollama)</option>
          </select>
        </div>
        <div>
          <label htmlFor="backend-url" className="mb-2 block text-sm font-medium">Backend API URL</label>
          <div className="flex flex-wrap gap-2">
            <input id="backend-url" type="url" disabled={!ready} value={settings.url} onChange={(e) => setSettings({ ...settings, url: e.target.value })} className="min-w-0 flex-1 rounded border border-input bg-card px-3 py-2 font-mono text-sm" />
            <Button variant="outline" disabled={!ready || connection.kind === "checking"} onClick={healthCheck}>{connection.kind === "checking" ? <Loader2 className="animate-spin" /> : <PlugZap />} Health Check</Button>
          </div>
          <div role="status" className="mt-2 text-xs text-muted-foreground">
            {connection.kind === "connected" ? <span className="text-success">Connected · {connection.latencyMs} ms</span> : connection.kind === "unreachable" ? <span className="text-warning">Unreachable · {connection.error} Check your server, CORS and browser local-network permissions.</span> : connection.kind === "checking" ? "Checking /health…" : "Not checked"}
          </div>
        </div>
        <div>
          <label htmlFor="query-path" className="mb-2 block text-sm font-medium">Query endpoint</label>
          <select id="query-path" disabled={!ready} value={settings.queryPath} onChange={(e) => setSettings({ ...settings, queryPath: e.target.value === "/query" ? "/query" : "/api/v1/query" })} className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-sm">
            <option>/api/v1/query</option><option>/query</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 border-y border-border py-4">
          <div><label htmlFor="org-header" className="text-sm font-medium">Organization Header</label><p className="mt-1 break-all font-mono text-xs text-muted-foreground">X-Organization-Id: {org?.id}</p></div>
          <Switch id="org-header" disabled={!ready} checked={settings.organizationHeader} onCheckedChange={(organizationHeader) => setSettings({ ...settings, organizationHeader })} />
        </div>
        {storageError && <p role="alert" className="text-xs text-warning">Browser storage is unavailable. These settings will not survive a reload.</p>}
        <p className="text-xs text-muted-foreground">Only Assistant queries use this connection. Documents, SQL Tool and benchmark data remain simulated. Localhost refers to this browser’s machine.</p>
      </section>
      <AiProviderSection />
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Query request</h2><Button variant="outline" size="sm" onClick={() => copy(curl, "cURL")}>{copied === "cURL" ? <Check /> : <Copy />} Copy cURL</Button></div>
        <pre className="overflow-x-auto rounded border border-border bg-muted p-4 font-mono text-xs leading-relaxed">{curl}</pre>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">FastAPI endpoint specification</h2><Button variant="outline" size="sm" disabled={!origin} onClick={() => copy(spec, "FastAPI specification")}>{copied === "FastAPI specification" ? <Check /> : <Copy />} Copy specification</Button></div>
        <p className="text-xs leading-relaxed text-muted-foreground">Run a FastAPI adapter in front of Ollama; Ollama’s native API is not this query contract. Allow this app’s exact origin in CORS and approve browser local-network access if prompted. Non-loopback HTTP may be blocked from an HTTPS page. The organization header is context, not authentication; your backend must enforce tenant access.</p>
        <pre className="max-h-[32rem] overflow-auto rounded border border-border bg-muted p-4 font-mono text-xs leading-relaxed">{spec}</pre>
      </section>
    </div>
  </div>;
}

/** Bring-your-own-key AI provider for this workspace's Assistant. Admin-managed. */
function AiProviderSection() {
  const { org, role } = useStore();
  const isAdmin = role === "Admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<{ provider: AiProviderId; fastModel: string | null; answerModel: string | null; updatedAt: string } | null>(null);
  const [provider, setProvider] = useState<AiProviderId>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [fastModel, setFastModel] = useState("");
  const [answerModel, setAnswerModel] = useState("");

  useEffect(() => {
    if (!org || !isAdmin) { setLoading(false); return; }
    let cancelled = false;
    getOrgAiSettings({ data: { orgId: org.id } })
      .then((row) => {
        if (cancelled || !row) return;
        setCurrent(row);
        setProvider(row.provider);
        setFastModel(row.fastModel ?? "");
        setAnswerModel(row.answerModel ?? "");
      })
      .catch(() => toast.error("Could not load AI provider settings."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org, isAdmin]);

  if (!org) return null;
  const def = AI_PROVIDERS[provider];

  const save = async () => {
    setSaving(true);
    try {
      await saveOrgAiSettings({ data: { orgId: org.id, provider, apiKey: apiKey.trim(), fastModel: fastModel.trim() || undefined, answerModel: answerModel.trim() || undefined } });
      setCurrent({ provider, fastModel: fastModel.trim() || null, answerModel: answerModel.trim() || null, updatedAt: new Date().toISOString() });
      setApiKey("");
      toast.success(`${def.label} key saved — the Assistant now uses it for this workspace.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the key.");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await clearOrgAiSettings({ data: { orgId: org.id } });
      setCurrent(null);
      setApiKey("");
      toast.success("Workspace key removed — the Assistant uses the project default again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the key.");
    } finally { setSaving(false); }
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><KeyRound className="h-4 w-4 text-primary" /> AI Provider (your own key)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Answer questions with your own provider account instead of the project default. The key is stored encrypted in the backend, never shown again, and only this workspace's Assistant uses it.
        </p>
      </div>
      {!isAdmin ? (
        <p className="rounded border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Only workspace admins can manage the AI provider key.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
      ) : (
        <>
          <div role="status" className="rounded border border-border bg-card px-3 py-2 text-xs">
            {current ? (
              <span className="text-success">Active: {AI_PROVIDERS[current.provider].label}{current.answerModel ? ` · ${current.answerModel}` : ""} · key saved {new Date(current.updatedAt).toLocaleDateString()}</span>
            ) : (
              <span className="text-muted-foreground">No workspace key — using the project default (OpenRouter).</span>
            )}
          </div>
          <div>
            <label htmlFor="ai-provider" className="mb-2 block text-sm font-medium">Provider</label>
            <select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)} className="w-full rounded border border-input bg-card px-3 py-2 text-sm">
              {AI_PROVIDER_IDS.map((id) => <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Get a key at <a href={def.docsUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{def.docsUrl.replace(/^https:\/\//, "")}</a>.
              {!def.embeddings && " This provider has no embeddings API, so document indexing and search keep using the built-in embeddings — only answer generation uses your key."}
            </p>
          </div>
          <div>
            <label htmlFor="ai-key" className="mb-2 block text-sm font-medium">API key</label>
            <input id="ai-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={current ? "Saved — enter a new key to replace it" : def.keyPlaceholder} className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ai-fast-model" className="mb-2 block text-sm font-medium">Fast model <span className="font-normal text-muted-foreground">(routing, grading)</span></label>
              <input id="ai-fast-model" value={fastModel} onChange={(e) => setFastModel(e.target.value)} placeholder={def.fastModel} className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-sm" />
            </div>
            <div>
              <label htmlFor="ai-answer-model" className="mb-2 block text-sm font-medium">Answer model</label>
              <input id="ai-answer-model" value={answerModel} onChange={(e) => setAnswerModel(e.target.value)} placeholder={def.answerModel} className="w-full rounded border border-input bg-card px-3 py-2 font-mono text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={saving || apiKey.trim().length < 8} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : <KeyRound />} {current ? "Replace key" : "Save key"}</Button>
            {current && <Button variant="outline" disabled={saving} onClick={remove}><Trash2 /> Remove key</Button>}
          </div>
        </>
      )}
    </section>
  );
}