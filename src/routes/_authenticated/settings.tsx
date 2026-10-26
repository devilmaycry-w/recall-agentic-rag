import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { BackendStatus } from "@/components/backend-status";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { curlExample, fastApiExample } from "@/lib/backend";

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