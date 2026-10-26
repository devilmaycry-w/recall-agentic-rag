import { describe, expect, it } from "vitest";
import { needsClarification, type ConversationTurn } from "./routing";

const HISTORY: ConversationTurn[] = [
  { role: "user", content: "summarize my resume" },
  { role: "assistant", content: "Your resume covers 8 years of backend engineering…" },
];

describe("needsClarification", () => {
  it("routes document questions to retrieval, never clarify", () => {
    expect(needsClarification("summarize my resume")).toBe(false);
    expect(needsClarification("tell me about my experience")).toBe(false);
    expect(needsClarification("review the Q3 board deck")).toBe(false);
    expect(needsClarification("what does the PTO policy say about accrual?")).toBe(false);
  });

  it("routes pure greetings and single-word noise to clarify", () => {
    expect(needsClarification("hi")).toBe(true);
    expect(needsClarification("Hello!")).toBe(true);
    expect(needsClarification("help")).toBe(true);
    expect(needsClarification("thanks")).toBe(true);
    expect(needsClarification("resume")).toBe(true); // single word, no context
    expect(needsClarification("   ")).toBe(true);
  });

  it("treats vague fragments as follow-ups when history exists", () => {
    expect(needsClarification("from projects", HISTORY)).toBe(false);
    expect(needsClarification("personal projects", HISTORY)).toBe(false);
    expect(needsClarification("what about the second one?", HISTORY)).toBe(false);
  });

  it("still routes greetings to clarify even with history", () => {
    expect(needsClarification("hi", HISTORY)).toBe(true);
    expect(needsClarification("hello", HISTORY)).toBe(true);
  });
});
