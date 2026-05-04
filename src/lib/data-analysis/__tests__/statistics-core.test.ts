import { describe, it, expect } from "vitest";
import {
  isFiniteNumber,
  toFiniteNumbers,
  mean,
  median,
  percentile,
  stdDev,
  mad,
  zScoreRobust,
  pearson,
  linearRegression,
  sturgesBuckets,
} from "../statistics-core";

describe("statistics-core", () => {
  it("isFiniteNumber rejeita NaN e Infinity", () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber("1")).toBe(false);
  });

  it("toFiniteNumbers converte strings numéricas e descarta lixo", () => {
    expect(toFiniteNumbers([1, "2", "3.5", "abc", null, undefined, NaN])).toEqual([1, 2, 3.5]);
  });

  it("mean retorna null para array vazio", () => {
    expect(mean([])).toBeNull();
    expect(mean([1, 2, 3])).toBe(2);
  });

  it("median lida com par e ímpar", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("percentile usa interpolação linear (numpy default)", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 1.0)).toBe(4);
    expect(() => percentile([1], 1.5)).toThrow();
  });

  it("stdDev é amostral (n-1)", () => {
    expect(stdDev([1, 1, 1])).toBe(0);
    const v = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(v).not.toBeNull();
    expect(v!).toBeCloseTo(2.138, 2);
  });

  it("mad é robusto a outliers", () => {
    const m = mad([1, 1, 1, 1, 1000]);
    expect(m).toBe(0); // todos zeros porque mediana = 1 e desvios = [0,0,0,0,999] -> mediana = 0
  });

  it("zScoreRobust retorna null quando MAD=0", () => {
    expect(zScoreRobust(5, [1, 1, 1])).toBeNull();
  });

  it("pearson detecta correlação positiva perfeita", () => {
    const r = pearson([1, 2, 3, 4], [2, 4, 6, 8]);
    expect(r).toBeCloseTo(1, 5);
  });

  it("pearson retorna null para variância zero", () => {
    expect(pearson([1, 1, 1], [2, 4, 6])).toBeNull();
  });

  it("linearRegression retorna fit consistente para reta perfeita", () => {
    const fit = linearRegression([0, 1, 2, 3], [10, 12, 14, 16]);
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeCloseTo(2);
    expect(fit!.intercept).toBeCloseTo(10);
    expect(fit!.r2).toBeCloseTo(1);
  });

  it("sturgesBuckets cresce log2", () => {
    expect(sturgesBuckets(1)).toBe(1);
    expect(sturgesBuckets(8)).toBe(4);
    expect(sturgesBuckets(1024)).toBe(11);
  });
});
