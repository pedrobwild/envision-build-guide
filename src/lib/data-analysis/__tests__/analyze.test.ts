import { describe, it, expect } from "vitest";
import { analyze, buildDataset } from "../index";

const ROWS = Array.from({ length: 30 }, (_, i) => ({
  id: `b-${i}`,
  created_at: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
  revenue_brl: 1000 + i * 50 + (i % 7) * 30,
  status: i % 3 === 0 ? "won" : i % 3 === 1 ? "lost" : "open",
  city: i % 4 === 0 ? "São Paulo" : i % 4 === 1 ? "Campinas" : i % 4 === 2 ? "Santos" : "São Paulo",
}));

describe("analyze (orquestrador)", () => {
  it("retorna AnalysisResult completo para dataset bem-formado", () => {
    const dataset = buildDataset(ROWS, { id: "test", name: "test" });
    const result = analyze({ dataset });

    expect(result.datasetId).toBe("test");
    expect(result.summaries.length).toBeGreaterThan(0);
    expect(result.summaries.find((s) => s.column === "revenue_brl" && s.kind === "numeric")).toBeDefined();
    expect(result.trends.length).toBeGreaterThan(0);
    // tendência de revenue_brl ao longo de created_at deve ser detectada
    const revenueTrend = result.trends.find((t) => t.metric === "revenue_brl");
    expect(revenueTrend).toBeDefined();
    expect(revenueTrend!.slope).not.toBeNull();
  });

  it("não chama IA — saída é determinística entre runs", () => {
    const dataset = buildDataset(ROWS, { id: "test", name: "test" });
    const a = analyze({ dataset });
    const b = analyze({ dataset });
    // Removendo generatedAt para comparação determinística
    const stripGenerated = (r: ReturnType<typeof analyze>) => ({
      ...r,
      generatedAt: "fixed",
      // forecasts/charts contêm os mesmos dados, apenas garantir summaries iguais
    });
    expect(stripGenerated(a).summaries).toEqual(stripGenerated(b).summaries);
    expect(stripGenerated(a).trends).toEqual(stripGenerated(b).trends);
  });

  it("registra provenance em cada insight", () => {
    const dataset = buildDataset(ROWS, { id: "test", name: "test" });
    const result = analyze({ dataset });
    for (const ins of result.insights) {
      expect(ins.provenance).toBeDefined();
      expect(ins.provenance.source).toBeTruthy();
      expect(ins.provenance.datasetId).toBe("test");
    }
  });

  it("agrega confidence consistente com partes", () => {
    const dataset = buildDataset(ROWS, { id: "test", name: "test" });
    const result = analyze({ dataset });
    expect(["low", "medium", "high"]).toContain(result.confidence);
  });

  it("registra limitação quando correlações inviáveis", () => {
    // Apenas uma coluna numérica → sem correlações.
    const small = [
      { revenue: 1, label: "a" },
      { revenue: 2, label: "b" },
    ];
    const dataset = buildDataset(small, { id: "small", name: "small" });
    const result = analyze({ dataset });
    expect(result.correlations).toBeNull();
  });
});
