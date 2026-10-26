import { afterEach, describe, expect, it, vi } from "vitest";
import { backendHeaders, backendUrl, checkBackend, curlExample, DEFAULT_SETTINGS, normalizeAnswer, queryBackend, restoreSettings } from "./backend";

afterEach(() => vi.unstubAllGlobals());
describe("Backend configuration and contract", () => {
  it("defaults to simulated mode and localhost:8000", () => {
    expect(restoreSettings(null)).toEqual({ mode: "simulated", url: "http://localhost:8000", organizationHeader: true, queryPath: "/api/v1/query" });
  });
  it("restores saved settings after reload", () => {
    const saved = { mode: "custom", url: "http://127.0.0.1:8000", organizationHeader: false, queryPath: "/query" };
    expect(restoreSettings(JSON.stringify(saved))).toEqual(saved);
  });
  it("uses the current workspace in X-Organization-Id", () => {
    expect(backendHeaders(DEFAULT_SETTINGS, "org_beta")["X-Organization-Id"]).toBe("org_beta");
  });
  it("does not send an organization header when toggled off", () => {
    expect(backendHeaders({ ...DEFAULT_SETTINGS, organizationHeader: false }, "org_beta")).not.toHaveProperty("X-Organization-Id");
  });
  it("checks GET /health", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    const latency = await checkBackend(DEFAULT_SETTINGS, "org_alpha");
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8000/health");
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
    expect(latency).toBeGreaterThanOrEqual(0);
  });
  it("sends POST query and session_id to /api/v1/query", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answer: "Live answer", route: "doc_retrieval", status: "grounded" }) });
    vi.stubGlobal("fetch", fetcher);
    await queryBackend(DEFAULT_SETTINGS, "org_alpha", "PTO policy?", "session-123");
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://localhost:8000/api/v1/query");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST", headers: { "X-Organization-Id": "org_alpha", "Content-Type": "application/json" }, body: '{"query":"PTO policy?","session_id":"session-123"}' });
  });
  it("supports the /query alternative", () => {
    expect(curlExample({ ...DEFAULT_SETTINGS, queryPath: "/query" }, "org_alpha")).toContain("http://localhost:8000/query");
  });
  it.each([['doc_retrieval', 'Document Retrieval'], ['sql_query', 'Read-Only SQL'], ['clarify', 'Clarification']])("maps live route %s", (route, expected) => {
    expect(normalizeAnswer({ answer: "Answer", route, status: "grounded" }, 23).route).toBe(expected);
  });
  it.each([['grounded', 'Grounded'], ['corrected', 'Corrected'], ['abstained', 'Abstained']])("maps live status %s", (status, expected) => {
    expect(normalizeAnswer({ answer: "Answer", route: "clarify", status }, 23).verification.kind).toBe(expected);
  });
  it("preserves live citations and reasoning trace", () => {
    const result = normalizeAnswer({ answer: "Answer", route: "doc_retrieval", status: "grounded", citations: [{ filename: "policy.pdf", page: 3, snippet: "Evidence" }], reasoning_trace: ["Retrieved policy"] }, 23);
    expect(result.citations[0]).toMatchObject({ docName: "policy.pdf", page: 3, snippet: "Evidence" });
    expect(result.trace[0]?.detail).toBe("Retrieved policy");
  });
  it("rejects unreachable endpoints without a simulated answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(queryBackend(DEFAULT_SETTINGS, "org_alpha", "Question", "session-123")).rejects.toThrow("Failed to fetch");
  });
  it("rejects malformed responses rather than inventing grounded status", () => {
    expect(() => normalizeAnswer({ answer: "Answer" }, 1)).toThrow("contract");
  });
  it("normalizes URL slashes and rejects non-HTTP protocols", () => {
    expect(backendUrl("http://localhost:8000/", "/health")).toBe("http://localhost:8000/health");
    expect(() => backendUrl("file:///tmp", "/health")).toThrow();
  });
});