import { describe, it, expect } from "vitest";
import { budgetsToDataset } from "../adapters/budgets";
import { analyze } from "../analyze";
import { analyzeQuality } from "@/lib/data-quality";
import type { BudgetWithSections } from "@/types/budget-common";

function makeBudget(overrides: Partial<BudgetWithSections> = {}): BudgetWithSections {
  return {
    id: "b-1",
    project_name: "Casa do Mar",
    client_name: "João",
    internal_status: "novo",
    pipeline_stage: "lead",
    lead_source: "indicacao",
    city: "São Paulo",
    bairro: "Pinheiros",
    property_type: "apartamento",
    location_type: "long_stay",
    priority: "normal",
    commercial_owner_id: null,
    estimator_owner_id: null,
    manual_total: 50_000,
    internal_cost: 30_000,
    view_count: 0,
    is_addendum: false,
    created_at: "2026-04-01T10:00:00Z",
    approved_at: null,
    closed_at: null,
    due_at: "2026-04-30T23:59:59Z",
    sections: [],
    adjustments: [],
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("budgetsToDataset", () => {
  it("declara colunas com kinds e roles esperados", () => {
    const ds = budgetsToDataset([makeBudget()]);
    const byName = Object.fromEntries(ds.columns.map((c) => [c.name, c]));
    expect(byName.id.kind).toBe("id");
    expect(byName.computed_total_brl.kind).toBe("currency");
    expect(byName.computed_total_brl.role).toBe("metric");
    expect(byName.created_at.kind).toBe("datetime");
    expect(byName.is_addendum.kind).toBe("boolean");
  });

  it("usa manual_total quando computed_total ausente", () => {
    const ds = budgetsToDataset([makeBudget({ manual_total: 99_999 })]);
    expect(ds.rows[0].manual_total_brl).toBe(99_999);
    expect(ds.rows[0].computed_total_brl).toBe(99_999);
  });

  it("resolve owner_name via profiles map", () => {
    const b = makeBudget({ commercial_owner_id: "uid-1" });
    const ds = budgetsToDataset([b], { profiles: { "uid-1": "Maria" } });
    expect(ds.rows[0].owner_name).toBe("Maria");
  });

  it("dataset resultante alimenta analyze() sem erros", () => {
    const cities = ["São Paulo", "Rio", "Curitiba", "BH"];
    const statuses = ["novo", "em_analise", "contrato_fechado", "lost", "published"];
    const budgets = Array.from({ length: 30 }, (_, i) =>
      makeBudget({
        id: `b-${i}`,
        project_name: `Projeto ${i}`,
        client_name: `Cliente ${i}`,
        city: cities[i % cities.length],
        manual_total: 10_000 + i * 1000 + (i % 7) * 230,
        view_count: (i * 3) % 17,
        created_at: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
        internal_status: statuses[i % statuses.length],
      }),
    );
    const ds = budgetsToDataset(budgets);
    const analysis = analyze({ dataset: ds });
    expect(analysis.summaries.length).toBeGreaterThan(5);
    expect(analysis.trends.length).toBeGreaterThan(0);
    const quality = analyzeQuality(ds);
    // healthScore válido em [0,1], independente do nível de issues
    // (depende de quantos campos foram preenchidos no test data)
    expect(quality.healthScore).toBeGreaterThanOrEqual(0);
    expect(quality.healthScore).toBeLessThanOrEqual(1);
    // Issues estão presentes mas estruturadas
    for (const issue of quality.issues) {
      expect(["info", "warning", "critical"]).toContain(issue.severity);
      expect(issue.id).toBeTruthy();
    }
  });
});
