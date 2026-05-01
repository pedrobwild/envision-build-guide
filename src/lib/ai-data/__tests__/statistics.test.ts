import { describe, it, expect } from "vitest";
import {
  mean,
  median,
  stdDev,
  percentChange,
  outliers,
  movingAverage,
  linearTrend,
  projectLinear,
  pearson,
  paretoCut,
  topNCount,
  topNSum,
} from "@/lib/ai-data/statistics";

describe("statistics", () => {
  it("mean handles empty + non-finite", () => {
    expect(mean([])).toBeNull();
    expect(mean([NaN, Infinity])).toBeNull();
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it("median works on odd and even lengths", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("stdDev requires >= 2 values", () => {
    expect(stdDev([5])).toBeNull();
    const sd = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).toBeCloseTo(2.138, 2);
  });

  it("percentChange protects against zero/null", () => {
    expect(percentChange(null, 10)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("outliers detects high/low values via IQR", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 100];
    const idx = outliers(v);
    expect(idx).toContain(8);
  });

  it("movingAverage smooths series", () => {
    const ma = movingAverage([1, 2, 3, 4, 5], 3);
    expect(ma.length).toBe(5);
    expect(ma[4]).toBeCloseTo(4, 5);
  });

  it("linearTrend & projection work on monotonic data", () => {
    const trend = linearTrend([2, 4, 6, 8]);
    expect(trend?.slope).toBeCloseTo(2, 5);
    const proj = projectLinear([2, 4, 6, 8], 2);
    expect(proj[0]).toBeCloseTo(10, 5);
    expect(proj[1]).toBeCloseTo(12, 5);
  });

  it("pearson returns ±1 for perfect correlation", () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 5);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it("paretoCut returns top items that explain 80% of total", () => {
    const { topN, share } = paretoCut([50, 25, 10, 5, 5, 5]);
    expect(topN).toBeLessThanOrEqual(3);
    expect(share).toBeGreaterThanOrEqual(0.8);
  });

  it("topNCount and topNSum group correctly", () => {
    const items = [
      { src: "a", val: 10 },
      { src: "a", val: 20 },
      { src: "b", val: 5 },
    ];
    const c = topNCount(items, (i) => i.src);
    expect(c[0].key).toBe("a");
    expect(c[0].count).toBe(2);
    const s = topNSum(items, (i) => i.src, (i) => i.val);
    expect(s[0].total).toBe(30);
  });
});
