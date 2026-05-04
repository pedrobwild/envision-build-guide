import { describe, it, expect } from "vitest";
import { inferColumnKind, inferColumnRole, coerceNumber, coerceTimestamp } from "../infer";

describe("infer", () => {
  it("detecta inteiros", () => {
    expect(inferColumnKind("count", [1, 2, 3, 4, 5])).toBe("integer");
  });

  it("detecta currency por hint de nome", () => {
    expect(inferColumnKind("revenue_brl", [100.5, 200.7, 300])).toBe("currency");
  });

  it("detecta percent por hint", () => {
    expect(inferColumnKind("conversion_rate_pct", [12.5, 13.0])).toBe("percent");
  });

  it("detecta boolean por mistura true/false/sim/não", () => {
    expect(inferColumnKind("flag", ["sim", "não", "sim", true, false])).toBe("boolean");
  });

  it("detecta date ISO", () => {
    expect(inferColumnKind("created_at", ["2026-01-01", "2026-02-01", "2026-03-01"])).toBe("date");
  });

  it("detecta datetime", () => {
    expect(
      inferColumnKind("created_at", ["2026-01-01T10:00:00Z", "2026-02-01T11:00:00Z", "2026-03-01T12:00:00Z"]),
    ).toBe("datetime");
  });

  it("detecta categorical para baixa cardinalidade", () => {
    expect(inferColumnKind("status", ["new", "open", "closed", "new", "open", "closed"])).toBe("categorical");
  });

  it("detecta id por nome", () => {
    expect(inferColumnKind("budget_id", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"])).toBe("id");
  });

  it("default para string", () => {
    const longTexts = Array.from({ length: 50 }, (_, i) => `texto livre ${i} aqui ${i * 2}`);
    expect(inferColumnKind("note", longTexts)).toBe("string");
  });

  it("inferColumnRole mapeia integer/currency/percent/number → metric", () => {
    expect(inferColumnRole("revenue", "currency", { distinctCount: 5, rowCount: 10 })).toBe("metric");
    expect(inferColumnRole("count", "integer", { distinctCount: 5, rowCount: 10 })).toBe("metric");
  });

  it("inferColumnRole considera id → identifier", () => {
    expect(inferColumnRole("client_id", "id", { distinctCount: 100, rowCount: 100 })).toBe("identifier");
  });

  it("inferColumnRole respeita declared", () => {
    expect(
      inferColumnRole("foo", "string", { distinctCount: 5, rowCount: 10, declared: "metric" }),
    ).toBe("metric");
  });

  it("coerceNumber aceita string numérica e boolean", () => {
    expect(coerceNumber("3.14")).toBe(3.14);
    expect(coerceNumber(true)).toBe(1);
    expect(coerceNumber(false)).toBe(0);
    expect(coerceNumber("abc")).toBeNull();
    expect(coerceNumber(null)).toBeNull();
  });

  it("coerceTimestamp parseia ISO e Date", () => {
    expect(coerceTimestamp("2026-01-01")).toBeGreaterThan(0);
    expect(coerceTimestamp(new Date(2026, 0, 1))).toBeGreaterThan(0);
    expect(coerceTimestamp("not-a-date")).toBeNull();
  });
});
