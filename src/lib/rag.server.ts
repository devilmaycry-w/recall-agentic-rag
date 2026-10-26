// Server-only agentic RAG pipeline: route → retrieve → grade → generate → verify,
// with bounded self-correction (max 2 retrieval retries, 1 regeneration).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentAnswer, Citation, TraceStep, Verification } from "./agent";
import { embedChunks } from "./indexing.server";
import { needsClarification, type ConversationTurn } from "./routing";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const FAST_MODEL = "openai/gpt-4o-mini"; // routing, grading, verification, rewriting
const ANSWER_MODEL = "openai/gpt-4o"; // final answer generation
const MAX_RETRIES = 2;
const MIN_SCORE = 0.5;
const MAX_HISTORY_TURNS = 6;

interface MatchedChunk {
  chunk_id: string;
  document_id: string;
  document_name: string;
  page: number;
  content: string;
  similarity: number;
}

async function chat(model: string, messages: { role: string; content: string }[], json = false, maxTokens = 512): Promise<string> {
  const key = process.env["OPENROUTER_API_KEY"];
  if (!key) throw new Error("OpenRouter API key is not configured. Add OPENROUTER_API_KEY in project secrets.");
  const res = await fetch(OR_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
    throw new Error(`OpenRouter returned HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty response.");
  return content;
}

async function chatJson<T>(model: string, messages: { role: string; content: string }[]): Promise<T> {
  const raw = await chat(model, messages, true);
  return JSON.parse(raw) as T;
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
    const content = await chat(FAST_MODEL, [
      {
        role: "system",
        content:
          "You are a knowledge assistant. The user's message was a greeting or too vague to search documents. " +
          "Respond warmly and ask one short, specific question about what they'd like to know from their documents.",
      },
      { role: "user", content: `${conversationBlock}Latest message: ${query}` },
    ]);
    trace.push({ name: "Document Retrieval", detail: "Skipped — clarification needed", ms: 0, status: "skip" });
    trace.push({ name: "Answer Generation", detail: "Clarifying question", ms: elapsed(t), status: "ok" });
    return { route, content, citations: [], verification: { kind: "Grounded" }, trace, latencyMs: elapsed(t0) };
  }

  // ── Step 1b: Resolve follow-ups into a standalone search query ─────────
  // Fragments like "from projects" only make sense against prior turns, so
  // rewrite them into a self-contained query before embedding.
  let searchQuery = query;
  if (recent.length) {
    t = performance.now();
    const rewrite = await chatJson<{ query: string }>(FAST_MODEL, [
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
    const grading = await chatJson<{ scores: number[] }>(FAST_MODEL, [
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
      const rewrite = await chatJson<{ query: string }>(FAST_MODEL, [
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
  let content = await chat(ANSWER_MODEL, genMessages(), false, 1024);
  trace.push({ name: "Answer Generation", detail: `${kept.length} cited sources · ${ANSWER_MODEL}`, ms: elapsed(t), status: "ok" });

  // ── Step 5: Groundedness check, one bounded regeneration ──────────────
  let verification: Verification = { kind: "Grounded" };
  t = performance.now();
  const check = await chatJson<{ grounded: boolean; issue: string }>(FAST_MODEL, [
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
    content = await chat(ANSWER_MODEL, genMessages(`Previous attempt was ungrounded: ${check.issue}. Stick strictly to the excerpts.`), false, 1024);
    trace.push({ name: "Answer Regeneration", detail: "Corrected answer generated", ms: elapsed(t), status: "ok" });
    t = performance.now();
    const recheck = await chatJson<{ grounded: boolean; issue: string }>(FAST_MODEL, [
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
