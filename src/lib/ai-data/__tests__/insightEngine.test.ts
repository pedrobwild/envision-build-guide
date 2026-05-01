import { describe, it, expect } from "vitest";
import { runInsightEngine, analyze } from "@/lib/ai-data/insightEngine";
import { planAnalysis, suggestQuestions } from "@/lib/ai-data/analysisPlanner";
import { rankInsights } from "@/lib/ai-data/insightScoring";
import type { BudgetWithSections } from "@/types/budget-common";

function mkBudget(overrides: Partial<BudgetWithSections> & { id: string }): BudgetWithSections {
  return {
    id: overrides.id,
    project_name: overrides.project_name ?? `Projeto ${overrides.id}`,
    client_name: overrides.client_name ?? `Cliente ${overrides.id}`,
    internal_status: overrides.internal_status ?? "in_progress",
    status: overrides.status ?? "draft",
    priority: overrides.priority ?? "normal",
    is_addendum: false,
    sections: overrides.sections ?? [],
    adjustments: overrides.adjustments ?? [],
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
    closed_at: overrides.closed_at ?? null,
    due_at: overrides.due_at ?? null,
    internal_cost: overrides.internal_cost ?? null,
    manual_total: overrides.manual_total ?? null,
    estimator_owner_id: overrides.estimator_owner_id ?? null,
    commercial_owner_id: overrides.commercial_owner_id ?? null,
    lead_source: overrides.lead_source ?? null,
    city: overrides.city ?? "São Paulo",
    bairro: overrides.bairro ?? null,
    property_type: overrides.property_type ?? null,
    view_count: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const RANGE = {
  from: new Date(Date.now() - 30 * 86_400_000),
  to: new Date(),
};

describe("insightEngine", () => {
  it("returns an empty-data insight when no budgets are present", () => {
    const insights = runInsightEngine({ budgets: [], range: RANGE });
    expect(insights.length).toBe(1);
    expect(insights[0].type).toBe("data_quality");
    expect(insights[0].limitations?.length).toBeGreaterThan(0);
  });

  it("produces multi-category insights for a healthy dataset", () => {
    const closed = Array.from({ length: 5 }).map((_, i) =>
      mkBudget({
        id: `c${i}`,
        internal_status: "contrato_fechado",
        manual_total: 100_000 + i * 5_000,
        internal_cost: 70_000,
        closed_at: new Date(Date.now() - i * 86_400_000).toISOString(),
        lead_source: i % 2 === 0 ? "instagram" : "google",
      }),
    );
    const overdue = Array.from({ length: 3 }).map((_, i) =>
      mkBudget({
        id: `o${i}`,
        internal_status: "in_progress",
        due_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        manual_total: 50_000,
      }),
    );
    const waiting = mkBudget({
      id: "w1",
      internal_status: "waiting_info",
      manual_total: 30_000,
      updated_at: new Date(Date.now() - 8 * 86_400_000).toISOString(),
    });
    const insights = runInsightEngine({
      budgets: [...closed, ...overdue, waiting],
      profiles: { "u1": "Alice" },
      range: RANGE,
    });
    expect(insights.length).toBeGreaterThan(3);
    expect(insights.some((i) => i.type === "operational")).toBe(true);
    expect(insights.some((i) => i.type === "financial")).toBe(true);
    expect(insights.every((i) => i.confidence >= 0 && i.confidence <= 1)).toBe(true);
  });

  it("flags data-quality issues when fields are missing", () => {
    const incomplete = Array.from({ length: 10 }).map((_, i) =>
      mkBudget({ id: `m${i}`, internal_cost: null, due_at: null, lead_source: null }),
    );
    const insights = runInsightEngine({ budgets: incomplete, range: RANGE });
    const dq = insights.find((i) => i.type === "data_quality");
    expect(dq).toBeDefined();
    expect(dq?.evidence.length).toBeGreaterThan(0);
  });

  it("ranks insights by severity then magnitude", () => {
    const insights = runInsightEngine({
      budgets: [
        mkBudget({ id: "a", internal_status: "in_progress", due_at: new Date(Date.now() - 5e9).toISOString() }),
        mkBudget({ id: "b", internal_status: "in_progress", due_at: new Date(Date.now() - 5e9).toISOString() }),
        mkBudget({ id: "c", internal_status: "in_progress", due_at: new Date(Date.now() - 5e9).toISOString() }),
        mkBudget({ id: "d", internal_status: "in_progress", due_at: new Date(Date.now() - 5e9).toISOString() }),
        mkBudget({ id: "e", internal_status: "in_progress", due_at: new Date(Date.now() - 5e9).toISOString() }),
      ],
      range: RANGE,
    });
    const ranked = rankInsights(insights);
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("analyze() honours analysis types when filtered", () => {
    const result = analyze(
      {
        budgets: [
          mkBudget({ id: "x", internal_status: "in_progress", due_at: new Date(Date.now() - 1e9).toISOString() }),
        ],
        range: RANGE,
      },
      { question: "quais ações priorizar?" },
      ["prescriptive", "operational"],
    );
    expect(result.insights.every((i) => ["prescriptive", "operational"].includes(i.type))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe("analysisPlanner", () => {
  it("classifies diagnostic question", () => {
    const plan = planAnalysis("Por que a margem caiu?");
    expect(plan.insightTypes).toContain("diagnostic");
    expect(plan.insightTypes).toContain("financial");
  });

  it("classifies predictive question", () => {
    const plan = planAnalysis("Qual a previsão de receita para os próximos meses?");
    expect(plan.insightTypes).toContain("predictive");
  });

  it("classifies prescriptive question", () => {
    const plan = planAnalysis("Quais ações devo priorizar hoje?");
    expect(plan.insightTypes).toContain("prescriptive");
  });

  it("recognises terms from the glossary", () => {
    const plan = planAnalysis("Qual a conversão por origem?");
    expect(plan.recognizedTerms.length).toBeGreaterThan(0);
    expect(plan.metric).toBe("conversion_rate");
  });

  it("returns sensible suggestion list", () => {
    const s = suggestQuestions({ role: "admin", screen: "/admin/operacoes" });
    expect(s.length).toBeGreaterThan(3);
  });
});
