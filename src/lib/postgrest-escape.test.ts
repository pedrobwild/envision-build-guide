import { describe, it, expect } from "vitest";
import { sanitizePostgrestPattern } from "./postgrest-escape";

describe("sanitizePostgrestPattern", () => {
  it("removes commas to prevent .or() injection", () => {
    expect(sanitizePostgrestPattern("a,name.eq.x")).toBe("a name.eq.x");
  });

  it("removes parentheses, quotes, colon, asterisk and backslash", () => {
    expect(sanitizePostgrestPattern("foo()'\"\\:*bar")).toBe("foo bar");
  });

  it("collapses repeated whitespace", () => {
    expect(sanitizePostgrestPattern("  a    b   ")).toBe("a b");
  });

  it("preserves accents and unicode characters", () => {
    expect(sanitizePostgrestPattern(" José da Silva ")).toBe("José da Silva");
  });

  it("returns empty string for input made only of forbidden chars", () => {
    expect(sanitizePostgrestPattern(",,,()")).toBe("");
  });
});
