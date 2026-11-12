import { describe, expect, it } from "vitest";
import { mapAgent, normalizeVerification } from "@/lib/api";

describe("agent response mapping", () => {
  it("does not claim verification when backend sends none", () => {
    expect(mapAgent({ answer: "x" }, 10).verification).toBe("NOT_EVALUATED");
  });
  it("maps corrected verdicts", () => {
    expect(normalizeVerification({ status: "corrected" })).toBe("CORRECTED");
  });
  it("returns no sources when backend sends none", () => {
    expect(mapAgent({ answer: "x", route: "sql" }, 10).sources).toEqual([]);
  });
});
