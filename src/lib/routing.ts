// Pure routing helpers for the assistant. Kept separate from rag.server.ts
// (which is server-only) so the rules are unit-testable.

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const GREETINGS =
  /^(hi|hii+|hello|hey|heyy+|yo|hiya|howdy|help|thanks|thank you|ok|okay|bye|good (morning|afternoon|evening))[.!?\s]*$/i;

/**
 * Clarification is reserved for pure greetings ("hi", "hello") and
 * single-word noise ("help"). Anything that asks to summarize, synthesize,
 * review, or answer from documents routes to document retrieval.
 *
 * When conversation history exists, even a vague fragment ("from projects")
 * is treated as a follow-up and routed to retrieval with context.
 */
export function needsClarification(query: string, history: ConversationTurn[] = []): boolean {
  const t = query.trim();
  if (!t) return true;
  if (GREETINGS.test(t)) return true;
  if (history.length > 0) return false; // follow-ups inherit conversation context
  const words = t.replace(/[^a-z0-9\s'-]/gi, " ").split(/\s+/).filter(Boolean);
  return words.length <= 1;
}
