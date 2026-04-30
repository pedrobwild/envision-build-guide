import { describe, it, expect } from "vitest";
import {
  calcSaleUnitPrice,
  calcItemSaleTotal,
  calcItemCostTotal,
  calcSectionCostTotal,
  calcSectionSaleTotal,
  calcGrandTotals,
} from "./budget-calc";

describe("calcSaleUnitPrice", () => {
  it("applies BDI percentage to cost", () => {
    expect(calcSaleUnitPrice(100, 30)).toBe(130);
  });
  it("returns cost when BDI is 0", () => {
    expect(calcSaleUnitPrice(200, 0)).toBe(200);
  });
  it("handles null/undefined inputs", () => {
    expect(calcSaleUnitPrice(null, null)).toBe(0);
    expect(calcSaleUnitPrice(undefined, 30)).toBe(0);
    expect(calcSaleUnitPrice(100, null)).toBe(100);
  });
});

describe("calcItemCostTotal", () => {
  it("uses unit_price * qty when unit_price exists", () => {
    expect(calcItemCostTotal({ internal_unit_price: 50, qty: 3 })).toBe(150);
  });
  it("defaults qty to 1 when null", () => {
    expect(calcItemCostTotal({ internal_unit_price: 80, qty: null })).toBe(80);
  });
  it("falls back to internal_total when no unit price", () => {
    expect(calcItemCostTotal({ internal_unit_price: null, internal_total: 500 })).toBe(500);
    expect(calcItemCostTotal({ internal_unit_price: 0, internal_total: 500 })).toBe(500);
  });
  it("treats internal_total as lump-sum (parity with calcItemSaleTotal — does NOT multiply by qty)", () => {
    // Parity: calcItemSaleTotal also returns total*(1+bdi/100) without qty in fallback.
    // Multiplying cost by qty here would inflate cost vs. sale and break BDI/margin.
    expect(calcItemCostTotal({ internal_unit_price: null, internal_total: 200, qty: 3 })).toBe(200);
    expect(calcItemCostTotal({ internal_unit_price: 0, internal_total: 100, qty: 5 })).toBe(100);
  });
  it("uses internal_total directly even when qty is null", () => {
    expect(calcItemCostTotal({ internal_unit_price: null, internal_total: 300, qty: null })).toBe(300);
  });
  it("returns 0 when both are null/zero", () => {
    expect(calcItemCostTotal({ internal_unit_price: null, internal_total: null })).toBe(0);
    expect(calcItemCostTotal({ internal_unit_price: 0, internal_total: 0 })).toBe(0);
    expect(calcItemCostTotal({})).toBe(0);
  });
});

describe("calcItemSaleTotal", () => {
  it("applies BDI to unit price * qty", () => {
    expect(calcItemSaleTotal({ internal_unit_price: 100, qty: 2, bdi_percentage: 50 })).toBe(300);
  });
  it("defaults qty to 1 when unit price exists", () => {
    expect(calcItemSaleTotal({ internal_unit_price: 100, qty: null, bdi_percentage: 20 })).toBe(120);
  });
  it("falls back to internal_total and applies BDI", () => {
    expect(calcItemSaleTotal({ internal_unit_price: null, internal_total: 800, bdi_percentage: 10 })).toBeCloseTo(880, 2);
  });
  it("falls back to internal_total without BDI", () => {
    expect(calcItemSaleTotal({ internal_unit_price: null, internal_total: 800, bdi_percentage: 0 })).toBe(800);
    expect(calcItemSaleTotal({ internal_unit_price: null, internal_total: 800 })).toBe(800);
  });
  it("returns 0 for empty item", () => {
    expect(calcItemSaleTotal({})).toBe(0);
  });
});

describe("calcSectionCostTotal", () => {
  it("sums item costs and multiplies by section qty", () => {
    const section = {
      qty: 2,
      items: [
        { internal_unit_price: 100, qty: 1 },
        { internal_unit_price: 50, qty: 2 },
      ],
    };
    // (100 + 100) * 2 = 400
    expect(calcSectionCostTotal(section)).toBe(400);
  });
  it("falls back to section_price when no items", () => {
    expect(calcSectionCostTotal({ qty: 1, section_price: 999, items: [] })).toBe(999);
  });
  it("falls back to section_price when item sum is 0", () => {
    expect(calcSectionCostTotal({ qty: 1, section_price: 500, items: [{ internal_unit_price: 0 }] })).toBe(500);
  });
  it("defaults section qty to 1", () => {
    const section = { qty: null, items: [{ internal_unit_price: 200, qty: 1 }] };
    expect(calcSectionCostTotal(section)).toBe(200);
  });
});

describe("calcSectionSaleTotal", () => {
  it("sums item sale totals with BDI", () => {
    const section = {
      qty: 1,
      items: [{ internal_unit_price: 100, qty: 1, bdi_percentage: 30 }],
    };
    expect(calcSectionSaleTotal(section)).toBe(130);
  });

  it("does not fall back to section_price when an item contribution exists but sale becomes zero with BDI -100%", () => {
    const section = {
      qty: 1,
      section_price: 4120,
      items: [{ internal_unit_price: 4120, qty: 1, bdi_percentage: -100 }],
    };
    expect(calcSectionSaleTotal(section)).toBe(0);
  });
});

describe("calcGrandTotals", () => {
  it("aggregates cost, sale, margin, and percentages", () => {
    const sections = [
      { qty: 1, items: [{ internal_unit_price: 100, qty: 1, bdi_percentage: 50 }] },
      { qty: 1, items: [{ internal_unit_price: 200, qty: 1, bdi_percentage: 25 }] },
    ];
    const result = calcGrandTotals(sections);
    expect(result.cost).toBe(300);   // 100 + 200
    expect(result.sale).toBe(400);   // 150 + 250
    expect(result.margin).toBe(100);
    expect(result.bdiPercent).toBeCloseTo(33.33, 1);
    expect(result.marginPercent).toBe(25);
  });
  it("returns zeros for empty sections", () => {
    const result = calcGrandTotals([]);
    expect(result).toEqual({ cost: 0, sale: 0, margin: 0, bdiPercent: 0, marginPercent: 0 });
  });
});
