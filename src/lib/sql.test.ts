import { describe, expect, it } from "vitest";
import { runSql } from "./sql";
import { routeQuery } from "./agent";

describe("SQL guardrails", () => {
  it("blocks writes", () => expect(runSql("DELETE FROM sales").ok).toBe(false));
  it("blocks stacked statements", () => expect(runSql("SELECT * FROM sales; DROP TABLE sales").ok).toBe(false));
  it("blocks unknown tables", () => expect(runSql("SELECT * FROM users").ok).toBe(false));
  it("caps rows at 50", () => {
    const r = runSql("SELECT * FROM sales");
    expect(r.ok && r.rows.length).toBe(50);
  });
});

describe("routing", () => {
  it("routes numbers to SQL", () => expect(routeQuery("Show Q3 revenue by region")).toBe("Read-Only SQL"));
  it("routes vague queries to clarification", () => expect(routeQuery("help")).toBe("Clarification"));
});
