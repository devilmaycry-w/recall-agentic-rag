// Registry of bring-your-own-key AI providers for the Assistant.
// Shared between the settings UI and the server RAG pipeline — no secrets here.

export type AiProviderId = "openrouter" | "openai" | "groq" | "anthropic" | "gemini";

export interface AiProviderDef {
  id: AiProviderId;
  label: string;
  /** OpenAI-compatible chat completions URL, or Anthropic messages URL. */
  chatUrl: string;
  apiStyle: "openai" | "anthropic";
  fastModel: string;
  answerModel: string;
  keyPlaceholder: string;
  keyPattern: string;
  docsUrl: string;
  /** Whether this provider can also serve embeddings (Groq and Anthropic cannot). */
  embeddings: boolean;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderDef> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    apiStyle: "openai",
    fastModel: "openai/gpt-4o-mini",
    answerModel: "openai/gpt-4o",
    keyPlaceholder: "sk-or-v1-...",
    keyPattern: "^sk-or-",
    docsUrl: "https://openrouter.ai/keys",
    embeddings: true,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    chatUrl: "https://api.openai.com/v1/chat/completions",
    apiStyle: "openai",
    fastModel: "gpt-4o-mini",
    answerModel: "gpt-4o",
    keyPlaceholder: "sk-proj-...",
    keyPattern: "^sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    embeddings: true,
  },
  groq: {
    id: "groq",
    label: "Groq",
    chatUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiStyle: "openai",
    fastModel: "llama-3.1-8b-instant",
    answerModel: "llama-3.3-70b-versatile",
    keyPlaceholder: "gsk_...",
    keyPattern: "^gsk_",
    docsUrl: "https://console.groq.com/keys",
    embeddings: false,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    chatUrl: "https://api.anthropic.com/v1/messages",
    apiStyle: "anthropic",
    fastModel: "claude-haiku-4-5",
    answerModel: "claude-sonnet-4-5",
    keyPlaceholder: "sk-ant-...",
    keyPattern: "^sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
    embeddings: false,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    chatUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiStyle: "openai",
    fastModel: "gemini-2.0-flash",
    answerModel: "gemini-2.5-pro",
    keyPlaceholder: "AIza...",
    keyPattern: "^AIza",
    docsUrl: "https://aistudio.google.com/apikey",
    embeddings: true,
  },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[];

export function isAiProviderId(value: string): value is AiProviderId {
  return value in AI_PROVIDERS;
}
