// In-memory session store: chat history, last agent result, uploads this session.
import { useSyncExternalStore } from "react";
import type { AgentResult, DocumentRecord } from "./api";

export interface ChatMessage { id: string; role: "user" | "assistant" | "error"; content: string; question?: string | undefined; result?: AgentResult | undefined; demo?: boolean | undefined; }
interface State { messages: ChatMessage[]; lastResult?: { question: string; result: AgentResult; demo: boolean }; uploads: DocumentRecord[]; lastLatency?: number; }
let state: State = { messages: [], uploads: [] };
const ls = new Set<() => void>();
export const session = {
  get: () => state,
  set: (p: Partial<State> | ((s: State) => Partial<State>)) => { state = { ...state, ...(typeof p === "function" ? p(state) : p) }; ls.forEach((l) => l()); },
};
const empty: State = { messages: [], uploads: [] };
export const useSession = () => useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, session.get, () => empty);
