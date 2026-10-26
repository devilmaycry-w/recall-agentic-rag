import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, AI_PROVIDER_IDS, isAiProviderId } from "./ai-providers";

describe("AI provider registry", () => {
  it("covers the five supported providers", () => {
    expect(AI_PROVIDER_IDS.sort()).toEqual(["anthropic", "gemini", "groq", "openai", "openrouter"]);
  });

  it("every provider has a chat URL, default models, and a key hint", () => {
    for (const id of AI_PROVIDER_IDS) {
      const p = AI_PROVIDERS[id];
      expect(p.chatUrl).toMatch(/^https:\/\//);
      expect(p.fastModel.length).toBeGreaterThan(0);
      expect(p.answerModel.length).toBeGreaterThan(0);
      expect(p.keyPlaceholder.length).toBeGreaterThan(0);
    }
  });

  it("only Anthropic uses the non-OpenAI messages API", () => {
    expect(AI_PROVIDERS.anthropic.apiStyle).toBe("anthropic");
    for (const id of AI_PROVIDER_IDS.filter((x) => x !== "anthropic")) {
      expect(AI_PROVIDERS[id].apiStyle).toBe("openai");
    }
  });

  it("Groq and Anthropic cannot serve embeddings", () => {
    expect(AI_PROVIDERS.groq.embeddings).toBe(false);
    expect(AI_PROVIDERS.anthropic.embeddings).toBe(false);
    expect(AI_PROVIDERS.openai.embeddings).toBe(true);
  });

  it("isAiProviderId validates stored provider values", () => {
    expect(isAiProviderId("groq")).toBe(true);
    expect(isAiProviderId("gemini")).toBe(true);
    expect(isAiProviderId("mistral")).toBe(false);
    expect(isAiProviderId("")).toBe(false);
  });
});
