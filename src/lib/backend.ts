import { z } from "zod";
import type { AgentAnswer, RouteKind } from "./agent";

export const SETTINGS_KEY = "recall.backend-settings.v1";
export const settingsSchema = z.object({
  mode: z.enum(["simulated", "custom"]).default("simulated"),
  url: z.string().default("http://localhost:8000"),
  organizationHeader: z.boolean().default(true),
  queryPath: z.enum(["/api/v1/query", "/query"]).default("/api/v1/query"),
});
export type BackendSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS = settingsSchema.parse({});

export function restoreSettings(raw: string | null): BackendSettings {
  try { return settingsSchema.parse(JSON.parse(raw ?? "{}")); }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function backendUrl(base: string, path: string) {
  const url = new URL(base.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter an HTTP or HTTPS backend URL without credentials, a query, or a fragment.");
  }
  return `${url.href.replace(/\/+$/, "")}${path}`;
}

export function backendHeaders(settings: BackendSettings, orgId: string, json = false) {
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(settings.organizationHeader ? { "X-Organization-Id": orgId } : {}) };
}

export async function checkBackend(settings: BackendSettings, orgId: string, signal?: AbortSignal) {
  const start = performance.now();
  const res = await fetch(backendUrl(settings.url, "/health"), {
    headers: backendHeaders(settings, orgId), signal: signal ?? AbortSignal.timeout(5000), credentials: "omit",
  });
  if (!res.ok) throw new Error(`Health check returned HTTP ${res.status}.`);
  return Math.round(performance.now() - start);
}

const responseSchema = z.object({
  answer: z.string(),
  route: z.enum(["doc_retrieval", "sql_query", "clarify"]),
  status: z.enum(["grounded", "corrected", "abstained"]),
  citations: z.array(z.object({ filename: z.string(), page: z.number(), snippet: z.string() })).default([]),
  reasoning_trace: z.array(z.string()).default([]),
});

export function normalizeAnswer(data: unknown, latencyMs: number): AgentAnswer {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new Error("The backend response does not match the expected answer contract. Check Backend Settings for the specification.");
  const v = parsed.data;
  const routes: Record<typeof v.route, RouteKind> = { doc_retrieval: "Document Retrieval", sql_query: "Read-Only SQL", clarify: "Clarification" };
  return {
    content: v.answer, route: routes[v.route], latencyMs,
    verification: v.status === "corrected" ? { kind: "Corrected", retry: 1, max: 2 } : { kind: v.status === "grounded" ? "Grounded" : "Abstained" },
    citations: v.citations.map((c, i) => ({ docName: c.filename, page: c.page, snippet: c.snippet, chunkId: `live-${i}`, confidence: 0 })),
    trace: v.reasoning_trace.map((detail, i) => ({ name: `Step ${i + 1}`, detail, ms: 0, status: "ok" })),
  };
}

export async function queryBackend(settings: BackendSettings, orgId: string, query: string, sessionId: string, signal?: AbortSignal) {
  const start = performance.now();
  const res = await fetch(backendUrl(settings.url, settings.queryPath), {
    method: "POST", headers: backendHeaders(settings, orgId, true),
    body: JSON.stringify({ query, session_id: sessionId }),
    signal: signal ?? AbortSignal.timeout(60000), credentials: "omit",
  });
  if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}. Check the selected query endpoint and server logs.`);
  return normalizeAnswer(await res.json(), Math.round(performance.now() - start));
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;
export function curlExample(settings: BackendSettings, orgId: string) {
  return `curl -X POST ${shellQuote(backendUrl(settings.url, settings.queryPath))} \\\n  -H 'Content-Type: application/json'${settings.organizationHeader ? ` \\\n  -H ${shellQuote(`X-Organization-Id: ${orgId}`)}` : ""} \\\n  -d '${JSON.stringify({ query: "What is our PTO policy?", session_id: "example-session" })}'`;
}

export function fastApiExample(origin: string) {
  return `# pip install fastapi uvicorn\n# Save as main.py; run: uvicorn main:app --host 127.0.0.1 --port 8000\nfrom fastapi import FastAPI, Header\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom pydantic import BaseModel\n\napp = FastAPI()\napp.add_middleware(\n    CORSMiddleware,\n    allow_origins=[${JSON.stringify(origin)}],\n    allow_methods=["GET", "POST"],\n    allow_headers=["Content-Type", "X-Organization-Id"],\n)\n\nclass QueryRequest(BaseModel):\n    query: str\n    session_id: str\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}\n\n@app.post("/api/v1/query")\n@app.post("/query")\ndef query(body: QueryRequest, x_organization_id: str | None = Header(default=None)):\n    # Validate tenant access and scope retrieval/session history to this organization.\n    # Connect your RAG pipeline / Ollama here. Ollama alone does not expose this contract.\n    # Contract example only: no LLM is invoked by this starter.\n    return {\n        "answer": "Connect your RAG pipeline to return a grounded answer.",\n        "route": "clarify",  # doc_retrieval | sql_query | clarify\n        "status": "abstained",  # grounded | corrected | abstained\n        "citations": [],  # [{"filename": "policy.pdf", "page": 1, "snippet": "..."}]\n        "reasoning_trace": ["No RAG pipeline configured"],\n    }\n`;
}