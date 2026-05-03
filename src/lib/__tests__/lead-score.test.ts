import { describe, it, expect } from "vitest";
import { computeLeadScore, TIER_META, type LeadScoreInput } from "../lead-score";

const baseInput: LeadScoreInput = {
  total_budgets: 0,
  won_budgets: 0,
  active_budgets: 0,
  avg_ticket: 0,
  pipeline_value: 0,
  total_won_value: 0,
  last_budget_at: null,
  days_since_last_activity: null,
  latest_internal_status: null,
};

const make = (overrides: Partial<LeadScoreInput>): LeadScoreInput => ({
  ...baseInput,
  ...overrides,
});

describe("computeLeadScore", () => {
  describe("recencyPoints", () => {
    it("usa days_since_last_activity quando disponível", () => {
      expect(computeLeadScore(make({ days_since_last_activity: 1 })).breakdown.recency).toBe(25);
      expect(computeLeadScore(make({ days_since_last_activity: 5 })).breakdown.recency).toBe(20);
      expect(computeLeadScore(make({ days_since_last_activity: 10 })).breakdown.recency).toBe(14);
      expect(computeLeadScore(make({ days_since_last_activity: 25 })).breakdown.recency).toBe(8);
      expect(computeLeadScore(make({ days_since_last_activity: 45 })).breakdown.recency).toBe(3);
      expect(computeLeadScore(make({ days_since_last_activity: 100 })).breakdown.recency).toBe(0);
    });

    it("zero quando não há atividade nem last_budget_at", () => {
      expect(computeLeadScore(make({ days_since_last_activity: null, last_budget_at: null })).breakdown.recency).toBe(0);
    });

    it("cai para last_budget_at se days_since_last_activity é null", () => {
      const today = new Date();
      const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeLeadScore(make({ days_since_last_activity: null, last_budget_at: fiveDaysAgo }));
      expect(result.breakdown.recency).toBe(20);
    });
  });

  describe("volumePoints", () => {
    it("buckets por número de orçamentos", () => {
      expect(computeLeadScore(make({ total_budgets: 0 })).breakdown.volume).toBe(0);
      expect(computeLeadScore(make({ total_budgets: 1 })).breakdown.volume).toBe(4);
      expect(computeLeadScore(make({ total_budgets: 2 })).breakdown.volume).toBe(8);
      expect(computeLeadScore(make({ total_budgets: 3 })).breakdown.volume).toBe(12);
      expect(computeLeadScore(make({ total_budgets: 4 })).breakdown.volume).toBe(15);
      expect(computeLeadScore(make({ total_budgets: 99 })).breakdown.volume).toBe(15);
    });

    it("trata null como 0", () => {
      expect(computeLeadScore(make({ total_budgets: null })).breakdown.volume).toBe(0);
    });
  });

  describe("ticketPoints", () => {
    it("buckets por ticket médio", () => {
      expect(computeLeadScore(make({ avg_ticket: 0 })).breakdown.ticket).toBe(0);
      expect(computeLeadScore(make({ avg_ticket: 19_999 })).breakdown.ticket).toBe(0);
      expect(computeLeadScore(make({ avg_ticket: 20_000 })).breakdown.ticket).toBe(4);
      expect(computeLeadScore(make({ avg_ticket: 60_000 })).breakdown.ticket).toBe(8);
      expect(computeLeadScore(make({ avg_ticket: 120_000 })).breakdown.ticket).toBe(12);
      expect(computeLeadScore(make({ avg_ticket: 250_000 })).breakdown.ticket).toBe(16);
      expect(computeLeadScore(make({ avg_ticket: 500_000 })).breakdown.ticket).toBe(20);
      expect(computeLeadScore(make({ avg_ticket: 5_000_000 })).breakdown.ticket).toBe(20);
    });
  });

  describe("pipelineVelocityPoints", () => {
    it("contrato_fechado pontua 15", () => {
      expect(
        computeLeadScore(make({ latest_internal_status: "contrato_fechado" })).breakdown.pipeline_velocity,
      ).toBe(15);
    });

    it("estágios HOT pontuam 14", () => {
      expect(computeLeadScore(make({ latest_internal_status: "negociacao" })).breakdown.pipeline_velocity).toBe(14);
      expect(computeLeadScore(make({ latest_internal_status: "published" })).breakdown.pipeline_velocity).toBe(14);
      expect(computeLeadScore(make({ latest_internal_status: "sent_to_client" })).breakdown.pipeline_velocity).toBe(14);
    });

    it("estágios MID pontuam 9", () => {
      expect(computeLeadScore(make({ latest_internal_status: "em_revisao" })).breakdown.pipeline_velocity).toBe(9);
      expect(computeLeadScore(make({ latest_internal_status: "in_progress" })).breakdown.pipeline_velocity).toBe(9);
    });

    it("estágios LOW pontuam 4", () => {
      expect(computeLeadScore(make({ latest_internal_status: "mql" })).breakdown.pipeline_velocity).toBe(4);
      expect(computeLeadScore(make({ latest_internal_status: "lead" })).breakdown.pipeline_velocity).toBe(4);
    });

    it("estágios DEAD anulam pipeline (0)", () => {
      expect(computeLeadScore(make({ latest_internal_status: "lost" })).breakdown.pipeline_velocity).toBe(0);
      expect(computeLeadScore(make({ latest_internal_status: "perdido" })).breakdown.pipeline_velocity).toBe(0);
      expect(computeLeadScore(make({ latest_internal_status: "archived" })).breakdown.pipeline_velocity).toBe(0);
    });

    it("status null retorna 0", () => {
      expect(computeLeadScore(make({ latest_internal_status: null })).breakdown.pipeline_velocity).toBe(0);
    });

    it("status desconhecido + múltiplos ativos => bônus 6, senão 3", () => {
      expect(
        computeLeadScore(make({ latest_internal_status: "desconhecido", active_budgets: 2 })).breakdown.pipeline_velocity,
      ).toBe(6);
      expect(
        computeLeadScore(make({ latest_internal_status: "desconhecido", active_budgets: 1 })).breakdown.pipeline_velocity,
      ).toBe(3);
      expect(
        computeLeadScore(make({ latest_internal_status: "desconhecido", active_budgets: null })).breakdown.pipeline_velocity,
      ).toBe(3);
    });
  });

  describe("conversionPoints", () => {
    it("cliente recorrente (>=2 ganhos) => 25", () => {
      expect(computeLeadScore(make({ won_budgets: 2, total_budgets: 4 })).breakdown.conversion).toBe(25);
      expect(computeLeadScore(make({ won_budgets: 5, total_budgets: 5 })).breakdown.conversion).toBe(25);
    });

    it("um único ganho => 18", () => {
      expect(computeLeadScore(make({ won_budgets: 1, total_budgets: 3 })).breakdown.conversion).toBe(18);
    });

    it("zero ganhos => 0", () => {
      expect(computeLeadScore(make({ won_budgets: 0, total_budgets: 5 })).breakdown.conversion).toBe(0);
    });

    it("ganhos sem total => 0 (defesa contra divisão estranha)", () => {
      expect(computeLeadScore(make({ won_budgets: 3, total_budgets: 0 })).breakdown.conversion).toBe(0);
    });
  });

  describe("score + tier", () => {
    it("clampa score em 0..100", () => {
      const maxedOut = computeLeadScore({
        total_budgets: 10,
        won_budgets: 5,
        active_budgets: 3,
        avg_ticket: 1_000_000,
        pipeline_value: 999_999,
        total_won_value: 999_999,
        last_budget_at: null,
        days_since_last_activity: 0,
        latest_internal_status: "negociacao",
      });
      expect(maxedOut.score).toBeLessThanOrEqual(100);
      expect(maxedOut.score).toBeGreaterThanOrEqual(0);
      expect(maxedOut.tier).toBe("hot");
    });

    it("input vazio é cold com score 0", () => {
      const r = computeLeadScore(baseInput);
      expect(r.score).toBe(0);
      expect(r.tier).toBe("cold");
    });

    it("limiar hot é exatamente 70", () => {
      // volume(15) + ticket(20) + recency(25) + pipeline(0) + conversion(18) = 78
      const hot = computeLeadScore(
        make({ total_budgets: 4, avg_ticket: 500_000, days_since_last_activity: 0, won_budgets: 1 }),
      );
      expect(hot.score).toBeGreaterThanOrEqual(70);
      expect(hot.tier).toBe("hot");
    });

    it("limiar warm é [40, 70)", () => {
      // ticket(16) + recency(25) = 41 → warm
      const warm = computeLeadScore(make({ avg_ticket: 250_000, days_since_last_activity: 0 }));
      expect(warm.score).toBeGreaterThanOrEqual(40);
      expect(warm.score).toBeLessThan(70);
      expect(warm.tier).toBe("warm");
    });

    it("score < 40 é cold", () => {
      const cold = computeLeadScore(make({ avg_ticket: 30_000 })); // 4 pts
      expect(cold.score).toBeLessThan(40);
      expect(cold.tier).toBe("cold");
    });
  });

  describe("buildReason", () => {
    it("contrato_fechado + recorrente => mensagem específica", () => {
      const r = computeLeadScore(
        make({ latest_internal_status: "contrato_fechado", won_budgets: 2, total_budgets: 3 }),
      );
      expect(r.reason).toContain("recorrente");
    });

    it("contrato_fechado único => mensagem 'em andamento'", () => {
      const r = computeLeadScore(
        make({ latest_internal_status: "contrato_fechado", won_budgets: 1, total_budgets: 1 }),
      );
      expect(r.reason).toContain("andamento");
    });

    it("frio sem contato há muito tempo cita os dias", () => {
      const r = computeLeadScore(make({ days_since_last_activity: 90 }));
      expect(r.tier).toBe("cold");
      expect(r.reason).toContain("90");
    });

    it("hot tier menciona destaque", () => {
      const r = computeLeadScore(
        make({ total_budgets: 4, avg_ticket: 500_000, days_since_last_activity: 0, won_budgets: 1 }),
      );
      expect(r.reason.toLowerCase()).toContain("quente");
    });
  });
});

describe("TIER_META", () => {
  it("tem entradas para todos os tiers", () => {
    expect(TIER_META.hot.label).toBe("Quente");
    expect(TIER_META.warm.label).toBe("Morno");
    expect(TIER_META.cold.label).toBe("Frio");
  });
});
