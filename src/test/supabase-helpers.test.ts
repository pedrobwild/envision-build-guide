import { describe, it, expect } from "vitest";
import { calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";

describe("calculateSectionSubtotal", () => {
  it("returns 0 for empty section", () => {
    expect(calculateSectionSubtotal({ items: [] })).toBe(0);
  });

  it("sums item internal_total values", () => {
    const section = {
      items: [
        { internal_total: 1000 },
        { internal_total: 2000 },
      ],
      qty: 1,
    };
    expect(calculateSectionSubtotal(section)).toBe(3000);
  });

  it("multiplies by qty when present", () => {
    const section = {
      items: [{ internal_total: 500 }],
      qty: 3,
    };
    expect(calculateSectionSubtotal(section)).toBe(1500);
  });

  it("falls back to section_price when items have no totals", () => {
    const section = {
      items: [{ internal_total: null }],
      section_price: 5000,
      qty: 2,
    };
    expect(calculateSectionSubtotal(section)).toBe(10000);
  });

  it("uses section_price when no items", () => {
    const section = { items: [], section_price: 800, qty: 1 };
    expect(calculateSectionSubtotal(section)).toBe(800);
  });

  it("defaults qty to 1", () => {
    const section = { items: [{ internal_total: 100 }] };
    expect(calculateSectionSubtotal(section)).toBe(100);
  });

  it("falls back to internal_unit_price when internal_total is missing", () => {
    const section = {
      items: [
        { internal_total: null, internal_unit_price: 50, qty: 2 },
        { internal_total: null, internal_unit_price: 100, qty: null },
      ],
      qty: 1,
    };
    // 50*2 + 100*1(default) = 200
    expect(calculateSectionSubtotal(section)).toBe(200);
  });

  it("mixes internal_total and internal_unit_price fallback", () => {
    const section = {
      items: [
        { internal_total: 300 },
        { internal_total: null, internal_unit_price: 150, qty: 1 },
      ],
      qty: 1,
    };
    expect(calculateSectionSubtotal(section)).toBe(450);
  });
});

describe("calculateBudgetTotal", () => {
  it("sums sections and adjustments", () => {
    const sections = [
      { items: [{ internal_total: 1000 }], qty: 1 },
      { items: [{ internal_total: 2000 }], qty: 1 },
    ];
    const adjustments = [
      { sign: -1, amount: 500 },
      { sign: 1, amount: 200 },
    ];
    // 3000 - 500 + 200 = 2700
    expect(calculateBudgetTotal(sections, adjustments)).toBe(2700);
  });

  it("handles empty adjustments", () => {
    const sections = [{ items: [{ internal_total: 1000 }], qty: 1 }];
    expect(calculateBudgetTotal(sections, [])).toBe(1000);
  });

  it("handles null adjustments", () => {
    const sections = [{ items: [{ internal_total: 1000 }], qty: 1 }];
    expect(calculateBudgetTotal(sections, null as unknown as { sign: number; amount: number }[])).toBe(1000);
  });
});
