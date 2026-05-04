import { describe, it, expect } from "vitest";
import { buildDataset } from "@/lib/data-analysis/buildDataset";
import { analyzeQuality } from "../analyzeQuality";

describe("analyzeQuality", () => {
  it("retorna report vazio para dataset perfeito", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `r-${i}`,
      revenue: 100 + i,
      city: i % 3 === 0 ? "SP" : i % 3 === 1 ? "RJ" : "MG",
      created_at: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const dataset = buildDataset(rows, { id: "perfect", name: "perfect" });
    const report = analyzeQuality(dataset);
    expect(report.counts.critical).toBe(0);
    expect(report.healthScore).toBeGreaterThan(0.9);
  });

  it("detecta missing_values em coluna semi-vazia", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `r-${i}`,
      maybe: i < 5 ? `val-${i}` : null,
    }));
    const dataset = buildDataset(rows, { id: "missing", name: "missing" });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "missing_values" && i.columns[0] === "maybe")).toBe(true);
  });

  it("detecta duplicates", () => {
    const rows = [
      { id: "1", value: 10 },
      { id: "2", value: 10 },
      { id: "3", value: 10 },
      { id: "4", value: 20 },
    ];
    const dataset = buildDataset(rows, { id: "dup", name: "dup" });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "duplicates")).toBe(true);
  });

  it("detecta outliers em coluna numérica com cauda extrema", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: `r-${i}`,
      // 27 valores em [10, 50] e 3 outliers extremos
      value: i < 27 ? 10 + i : 100_000 + i,
    }));
    const dataset = buildDataset(rows, { id: "out", name: "out" });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "outliers" && i.columns[0] === "value")).toBe(true);
  });

  it("detecta colunas constantes", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `r-${i}`,
      same: "always",
    }));
    const dataset = buildDataset(rows, { id: "const", name: "const" });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "constant_column" && i.columns[0] === "same")).toBe(true);
  });

  it("detecta primary key candidate", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ unique_id: `uid-${i}`, value: i }));
    const dataset = buildDataset(rows, { id: "pk", name: "pk" });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "primary_key_candidate")).toBe(true);
  });

  it("detecta high cardinality em coluna texto", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: `r-${i}`,
      free_text: `nota livre única ${i} para o registro especial ${i * 17}`,
    }));
    const dataset = buildDataset(rows, { id: "hc", name: "hc" });
    const report = analyzeQuality(dataset);
    expect(
      report.issues.some((i) => i.kind === "high_cardinality" && i.columns[0] === "free_text"),
    ).toBe(true);
  });

  it("detecta datas inválidas", () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `r-${i}`,
        when: `2026-04-${String((i % 28) + 1).padStart(2, "0")}`,
      })),
      { id: "bad-1", when: "not-a-date" },
      { id: "bad-2", when: "1850-01-01" },
    ];
    const dataset = buildDataset(rows, {
      id: "bd",
      name: "bd",
      declaredColumns: { when: { kind: "date" } },
    });
    const report = analyzeQuality(dataset);
    expect(report.issues.some((i) => i.kind === "invalid_dates")).toBe(true);
  });

  it("ordena issues por severidade", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}`, x: i, all_null: null })),
      // Vários nulls forçam critical em all_null
    ];
    const dataset = buildDataset(rows, { id: "ord", name: "ord" });
    const report = analyzeQuality(dataset);
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < report.issues.length; i++) {
      expect(severityOrder[report.issues[i - 1].severity]).toBeLessThanOrEqual(
        severityOrder[report.issues[i].severity],
      );
    }
  });

  it("respeita disable", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `r-${i}`,
      maybe: i < 5 ? `val-${i}` : null,
    }));
    const dataset = buildDataset(rows, { id: "dis", name: "dis" });
    const report = analyzeQuality(dataset, { disable: ["missing_values"] });
    expect(report.issues.every((i) => i.kind !== "missing_values")).toBe(true);
  });
});
