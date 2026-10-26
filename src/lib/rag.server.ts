// Server-only agentic RAG pipeline: route → retrieve → grade → generate → verify,
// with bounded self-correction (max 2 retrieval retries, 1 regeneration).
// Chat models come from the workspace's configured AI provider (BYOK) or the
// project's OpenRouter secret as the default. Embeddings always use the
// built-in route (Groq and Anthropic have no embeddings API).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAnswer, Citation, TraceStep, Verification } from "./agent";
import { embedChunks } from "./indexing.server";
import { needsClarification, type ConversationTurn } from "./routing";
import { AI_PROVIDERS, isAiProviderId, type AiProviderDef } from "./ai-providers";

const MAX_RETRIES = 2;
const MIN_SCORE = 0.5;
const MAX_HISTORY_TURNS = 6;

export interface AiConfig {
  provider: AiProviderDef;
  apiKey: string;
  fastModel: string;
  answerModel: string;
}

interface MatchedChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  page: number;
  content: string;
  similarity: number;
}

/**
 * Resolve the workspace's AI provider config. A workspace admin can store
 * their own provider key (org_ai_settings); otherwise fall back to the
 * project's OpenRouter secret. Keys are read with the service role only
 * after the caller's membership has been verified by the caller.
 */
export async function loadAiConfig(orgId: string): Promise<AiConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("org_ai_settings")
    .select("provider, api_key, fast_model, answer_model")
    .eq("org_id", orgId)
    .maybeSingle();
  if (data && isAiProviderId(data.provider) && data.api_key) {
    const provider = AI_PROVIDERS[data.provider];
    return {
      provider,
      apiKey: data.api_key,
      fastModel: data.fast_model?.trim() || provider.fastModel,
      answerModel: data.answer_model?.trim() || provider.answerModel,
    };
  }
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) {
    throw new Error("No AI provider configured. Add OPENROUTER_API_KEY in project secrets, or set a workspace AI provider in Settings.");
  }
  const provider = AI_PROVIDERS.openrouter;
  return { provider, apiKey: key, fastModel: provider.fastModel, answerModel: provider.answerModel };
}

async function chat(cfg: AiConfig, model: string, messages: { role: string; content: string }[], json = false, maxTokens = 512): Promise<string> {
  if (cfg.provider.apiStyle === "anthropic") {
    const system =
      messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") +
      (json ? "\nReply with a single JSON object only — no prose, no code fences." : "");
    const res = await fetch(cfg.provider.chatUrl, {
      method: "POST",
      headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        ...(system.trim() ? { system } : {}),
        messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${cfg.provider.label} returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const content = data.content?.find((b) => b.type === "text")?.text;
    if (!content) throw new Error(`${cfg.provider.label} returned an empty response.`);
    return content;
  }

  const res = await fetch(cfg.provider.chatUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${cfg.provider.label} returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${cfg.provider.label} returned an empty response.`);
  return content;
}

async function chatJson<T>(cfg: AiConfig, model: string, messages: { role: string; content: string }[]): Promise<T> {
  const raw = await chat(cfg, model, messages, true);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Anthropic has no enforced JSON mode — tolerate prose around the object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`${cfg.provider.label} returned invalid JSON.`);
  }
}

const elapsed = (start: number) => Math.round(performance.now() - start);

export async function runRag(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
  history: ConversationTurn[] = [],
): Promise<AgentAnswer> {
  const t0 = performance.now();
  const trace: TraceStep[] = [];
  const ai = await loadAiConfig(orgId);
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const conversationBlock = recent.length
    ? `Recent conversation:\n${recent.map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content.slice(0, 500)}`).join("\n")}\n\n`
    : "";

  // ── Step 1: Query routing ──────────────────────────────────────────────
  // Deterministic: doc_retrieval is the default for anything that asks to
  // summarize, synthesize, review, or answer from documents. Clarify is
  // reserved for pure greetings and single-word noise with no history.
  let t = performance.now();
  const route = needsClarification(query, recent) ? "Clarification" : "Document Retrieval";
  trace.push({
    name: "Query Routing",
    detail:
      route === "Clarification"
        ? "Clarification — greeting or underspecified single-word message"
        : recent.length
          ? "Document Retrieval — default (follow-up resolved against conversation context)"
          : "Document Retrieval — default for document questions",
    ms: elapsed(t),
    status: "ok",
  });

  if (route === "Clarification") {
    t = performance.now();
    const content = await chat(ai, ai.fastModel, [
      {
        role: "system",
        content:
          "You are a knowledge assistant. The user's message was a greeting or too vague to search documents. " +
          "Respond warmly and ask one short, specific question about what they'd like to know from their documents.",
      },
      { role: "user", content: `${conversationBlock}Latest message: ${query}` },
    ]);
    trace.push({ name: "Document Retrieval", detail: "Skipped — clarification needed", ms: 0, status: "skip" });
    trace.push({ name: "Answer Generation", detail: `Clarifying question · ${ai.provider.label}`, ms: elapsed(t), status: "ok" });
    return { route, content, citations: [], verification: { kind: "Grounded" }, trace, latencyMs: elapsed(t0) };
  }

  // ── Step 1b: Resolve follow-ups into a standalone search query ─────────
  // Fragments like "from projects" only make sense against prior turns, so
  // rewrite them into a self-contained query before embedding.
  let searchQuery = query;
  if (recent.length) {
    t = performance.now();
    const rewrite = await chatJson<{ query: string }>(ai, ai.fastModel, [
      {
        role: "system",
        content:
          'Given the recent conversation, rewrite the latest user message as a self-contained semantic search query that preserves its intent. ' +
          'If it is already self-contained, return it unchanged. One sentence. Reply JSON: {"query":"..."}',
      },
      { role: "user", content: `${conversationBlock}Latest message: ${query}` },
    ]);
    if (rewrite.query && rewrite.query.trim() && rewrite.query.trim().toLowerCase() !== query.trim().toLowerCase()) {
      searchQuery = rewrite.query.trim();
      trace.push({ name: "Context Resolution", detail: `Follow-up resolved → "${searchQuery}"`, ms: elapsed(t), status: "ok" });
    } else {
      trace.push({ name: "Context Resolution", detail: "Message already self-contained", ms: elapsed(t), status: "ok" });
    }
  }

  // ── Steps 2-3: Retrieval + relevance grading, with bounded rewrite retries ──
  let kept: (MatchedChunk & { score: number })[] = [];
  let attempts = 0;
  let currentQuery = searchQuery;
  while (attempts <= MAX_RETRIES && kept.length === 0) {
    t = performance.now();
    const [embedding] = await embedChunks([currentQuery]);
    const { data, error } = await supabase.rpc("match_document_chunks", {
      p_org_id: orgId,
      query_embedding: JSON.stringify(embedding),
      match_count: 8,
    });
    if (error) throw new Error(`Vector search failed: ${error.message}`);
    const matches = (data ?? []) as MatchedChunk[];
    trace.push({
      name: attempts === 0 ? "Document Retrieval" : `Document Retrieval (Retry ${attempts}/${MAX_RETRIES})`,
      detail: matches.length
        ? `${matches.length} chunks · top similarity ${(matches[0]!.similarity * 100).toFixed(0)}%`
        : "No indexed chunks found in this workspace",
      ms: elapsed(t),
      status: matches.length ? "ok" : "warn",
    });
    if (!matches.length) break;

    t = performance.now();
    const grading = await chatJson<{ scores: number[] }>(ai, ai.fastModel, [
      {
        role: "system",
        content:
          'Grade how relevant each numbered excerpt is to the question. Reply JSON: {"scores":[0..1 per excerpt, in order]}. ' +
          "1.0 = directly answers it, 0.5 = partially relevant, 0 = irrelevant.",
      },
      {
        role: "user",
        content: `Question: ${currentQuery}\n\n${matches.map((m, i) => `[${i + 1}] (${m.document_name} p.${m.page}) ${m.content.slice(0, 600)}`).join("\n\n")}`,
      },
    ]);
    kept = matches
      .map((m, i) => ({ ...m, score: Number(grading.scores?.[i] ?? 0) }))
      .filter((m) => m.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    trace.push({
      name: attempts === 0 ? "Relevance Grading" : `Relevance Grading (Retry ${attempts}/${MAX_RETRIES})`,
      detail: kept.length ? `${kept.length}/${matches.length} chunks kept (score ≥ ${MIN_SCORE})` : "All chunks below relevance threshold",
      ms: elapsed(t),
      status: kept.length ? "ok" : "warn",
    });

    if (kept.length === 0 && attempts < MAX_RETRIES) {
      t = performance.now();
      const rewrite = await chatJson<{ query: string }>(ai, ai.fastModel, [
        { role: "system", content: 'Rewrite the question as a better semantic search query: expand acronyms, add likely synonyms, keep it one sentence. Reply JSON: {"query":"..."}' },
        { role: "user", content: `${conversationBlock}Question: ${searchQuery}` },
      ]);
      currentQuery = rewrite.query || searchQuery;
      trace.push({ name: "Query Rewrite", detail: currentQuery, ms: elapsed(t), status: "ok" });
    }
    attempts++;
  }

  if (kept.length === 0) {
    trace.push({ name: "Answer Generation", detail: "Skipped — no relevant evidence", ms: 0, status: "skip" });
    trace.push({ name: "Groundedness Check", detail: "Abstained: insufficient evidence after retries", ms: 0, status: "fail" });
    return {
      route,
      content: "I couldn't find enough relevant evidence in this workspace's indexed documents to answer that confidently. Try rephrasing, or upload a document that covers this topic.",
      citations: [],
      verification: { kind: "Abstained" },
      trace,
      latencyMs: elapsed(t0),
    };
  }

  const citations: Citation[] = kept.map((m) => ({
    docName: m.document_name,
    page: m.page,
    confidence: Math.max(0, Math.min(1, m.similarity)),
    snippet: m.content,
    chunkId: m.chunk_id.slice(0, 8),
  }));
  const context = kept.map((m, i) => `[${i + 1}] (${m.document_name}, page ${m.page})\n${m.content}`).join("\n\n");
  const genMessages = (extra?: string) => [
    {
      role: "system",
      content:
        "You are a knowledge assistant. Answer ONLY from the numbered excerpts below. Cite every claim with [n] markers matching the excerpt numbers. " +
        "If the excerpts don't fully answer the question, say exactly what is missing. Be concise. " +
        "Use the recent conversation only to understand what the user is referring to — never as a source of facts." +
        (extra ? ` ${extra}` : ""),
    },
    { role: "user", content: `${conversationBlock}Question: ${query}\n\nExcerpts:\n${context}` },
  ];

  // ── Step 4: Answer generation ──────────────────────────────────────────
  t = performance.now();
  let content = await chat(ai, ai.answerModel, genMessages(), false, 1024);
  trace.push({ name: "Answer Generation", detail: `${kept.length} cited sources · ${ai.answerModel} via ${ai.provider.label}`, ms: elapsed(t), status: "ok" });

  // ── Step 5: Groundedness check, one bounded regeneration ──────────────
  let verification: Verification = { kind: "Grounded" };
  t = performance.now();
  const check = await chatJson<{ grounded: boolean; issue: string }>(ai, ai.fastModel, [
    {
      role: "system",
      content:
        'Verify every factual claim in the answer is directly supported by the numbered excerpts. Reply JSON: {"grounded":true|false,"issue":"short description if false"}.',
    },
    { role: "user", content: `Excerpts:\n${context}\n\nAnswer:\n${content}` },
  ]);
  if (check.grounded) {
    trace.push({ name: "Groundedness Check", detail: "All claims supported by cited excerpts", ms: elapsed(t), status: "ok" });
  } else {
    trace.push({ name: "Groundedness Check", detail: `Failed — ${check.issue}. Regenerating (1/1)`, ms: elapsed(t), status: "warn" });
    t = performance.now();
    content = await chat(ai, ai.answerModel, genMessages(`Previous attempt was ungrounded: ${check.issue}. Stick strictly to the excerpts.`), false, 1024);
    trace.push({ name: "Answer Regeneration", detail: "Corrected answer generated", ms: elapsed(t), status: "ok" });
    t = performance.now();
    const recheck = await chatJson<{ grounded: boolean; issue: string }>(ai, ai.fastModel, [
      {
        role: "system",
        content: 'Verify every factual claim in the answer is directly supported by the numbered excerpts. Reply JSON: {"grounded":true|false,"issue":"short description if false"}.',
      },
      { role: "user", content: `Excerpts:\n${context}\n\nAnswer:\n${content}` },
    ]);
    if (recheck.grounded) {
      verification = { kind: "Corrected", retry: 1, max: 1 };
      trace.push({ name: "Groundedness Recheck", detail: "Corrected answer verified", ms: elapsed(t), status: "ok" });
    } else {
      verification = { kind: "Abstained" };
      content = "I found potentially relevant documents, but I couldn't produce an answer that stays fully grounded in them. I'd rather abstain than risk telling you something wrong.";
      trace.push({ name: "Groundedness Recheck", detail: `Still ungrounded — ${recheck.issue}. Abstaining.`, ms: elapsed(t), status: "fail" });
    }
  }

  return { route, content, citations, verification, trace, latencyMs: elapsed(t0) };
}
