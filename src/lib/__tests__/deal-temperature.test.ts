import { describe, it, expect } from "vitest";
import {
  computeDealTemperature,
  suggestNextAction,
  type DealTemperatureInput,
} from "../deal-temperature";

const baseTemp: DealTemperatureInput = {
  daysSinceLastActivity: null,
  daysInStage: null,
  manualTotal: null,
  internalStatus: null,
};

const makeTemp = (o: Partial<DealTemperatureInput>): DealTemperatureInput => ({ ...baseTemp, ...o });

describe("computeDealTemperature", () => {
  describe("status terminal", () => {
    it.each(["contrato_fechado", "lost", "perdido", "archived"])(
      "%s curto-circuita para Encerrado",
      (status) => {
        const r = computeDealTemperature(makeTemp({ internalStatus: status }));
        expect(r.temperature).toBe("cold");
        expect(r.score).toBe(0);
        expect(r.label).toBe("Encerrado");
        expect(r.topReason).toBe("Negócio finalizado");
      },
    );

    it("status terminal ignora demais sinais", () => {
      const r = computeDealTemperature({
        internalStatus: "lost",
        daysSinceLastActivity: 0,
        daysInStage: 0,
        manualTotal: 1_000_000,
      });
      expect(r.temperature).toBe("cold");
    });
  });

  describe("activityScore buckets", () => {
    it("days null pontua baixo (10)", () => {
      // 10 * 0.5 + stage(60) * 0.3 + value(40) * 0.2 = 5 + 18 + 8 = 31
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: null }));
      expect(r.score).toBe(31);
      expect(r.temperature).toBe("cold");
    });

    it("0..2 dias pontua 100", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0 }));
      // 100 * 0.5 + 60 * 0.3 + 40 * 0.2 = 50 + 18 + 8 = 76
      expect(r.score).toBe(76);
      expect(r.temperature).toBe("hot");
    });

    it("escalonamento até > 30 dias", () => {
      const a = computeDealTemperature(makeTemp({ daysSinceLastActivity: 5 })); // 80
      const b = computeDealTemperature(makeTemp({ daysSinceLastActivity: 10 })); // 55
      const c = computeDealTemperature(makeTemp({ daysSinceLastActivity: 25 })); // 15
      const d = computeDealTemperature(makeTemp({ daysSinceLastActivity: 100 })); // 5
      expect(a.score).toBeGreaterThan(b.score);
      expect(b.score).toBeGreaterThan(c.score);
      expect(c.score).toBeGreaterThan(d.score);
    });
  });

  describe("limiares de temperatura", () => {
    it(">= 65 é hot", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, daysInStage: 0 }));
      expect(r.temperature).toBe("hot");
      expect(r.label).toBe("Quente");
    });

    it("[35, 65) é warm", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 10, daysInStage: 10 }));
      expect(r.temperature).toBe("warm");
      expect(r.label).toBe("Morno");
    });

    it("< 35 é cold", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 100, daysInStage: 100 }));
      expect(r.temperature).toBe("cold");
      expect(r.label).toBe("Frio");
    });
  });

  describe("valueScore", () => {
    it("manualTotal null/<=0 retorna sub-score 40 (neutro)", () => {
      const a = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, manualTotal: null }));
      const b = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, manualTotal: 0 }));
      const c = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, manualTotal: -1000 }));
      expect(a.score).toBe(b.score);
      expect(b.score).toBe(c.score);
    });

    it("clampa em [10, 100] com âncora R$ 200k", () => {
      const small = computeDealTemperature(makeTemp({ daysSinceLastActivity: 100, daysInStage: 100, manualTotal: 100 }));
      const huge = computeDealTemperature(makeTemp({ daysSinceLastActivity: 100, daysInStage: 100, manualTotal: 10_000_000 }));
      // small ainda contribui ao menos 10 * 0.2 = 2
      // huge contribui 100 * 0.2 = 20
      expect(huge.score).toBeGreaterThan(small.score);
    });
  });

  describe("topReason", () => {
    it("retorna 'Tudo em ordem' quando tudo pontua bem", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, daysInStage: 0, manualTotal: 200_000 }));
      expect(r.topReason).toBe("Tudo em ordem");
    });

    it("aponta atividade quando ela é o pior componente", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 100, daysInStage: 0, manualTotal: 200_000 }));
      expect(r.topReason).toBe("Sem atividade recente");
    });

    it("aponta etapa quando ela é o pior componente", () => {
      const r = computeDealTemperature(makeTemp({ daysSinceLastActivity: 0, daysInStage: 100, manualTotal: 200_000 }));
      expect(r.topReason).toBe("Parado há muito tempo");
    });
  });
});

describe("suggestNextAction", () => {
  it("retorna null para status terminal", () => {
    expect(
      suggestNextAction({
        internalStatus: "contrato_fechado",
        daysSinceLastActivity: 30,
        daysInStage: 30,
        hasScheduledActivity: false,
      }),
    ).toBeNull();
    expect(
      suggestNextAction({
        internalStatus: "lost",
        daysSinceLastActivity: 0,
        daysInStage: 0,
        hasScheduledActivity: false,
      }),
    ).toBeNull();
  });

  it("retorna null se já tem atividade agendada", () => {
    expect(
      suggestNextAction({
        internalStatus: "negociacao",
        daysSinceLastActivity: 30,
        daysInStage: 30,
        hasScheduledActivity: true,
      }),
    ).toBeNull();
  });

  describe("sem atividade (since=null)", () => {
    it("MQL/qualificacao sugerem 'Qualificar lead'", () => {
      const r = suggestNextAction({
        internalStatus: "mql",
        daysSinceLastActivity: null,
        daysInStage: 0,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Qualificar lead");
      expect(r?.urgency).toBe("high");
      expect(r?.type).toBe("call");
    });

    it("lead/validacao_briefing sugerem 'Iniciar contato'", () => {
      const r = suggestNextAction({
        internalStatus: "validacao_briefing",
        daysSinceLastActivity: null,
        daysInStage: 0,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Iniciar contato");
      expect(r?.urgency).toBe("high");
    });

    it("outros status sem atividade => null (evita ruído)", () => {
      expect(
        suggestNextAction({
          internalStatus: "negociacao",
          daysSinceLastActivity: null,
          daysInStage: 0,
          hasScheduledActivity: false,
        }),
      ).toBeNull();
    });
  });

  describe("atividade antiga", () => {
    it(">=14 dias => Ligar high", () => {
      const r = suggestNextAction({
        internalStatus: "negociacao",
        daysSinceLastActivity: 20,
        daysInStage: 5,
        hasScheduledActivity: false,
      });
      expect(r?.label).toContain("Ligar");
      expect(r?.label).toContain("20d");
      expect(r?.urgency).toBe("high");
    });

    it(">=7 e <14 dias => Follow-up medium", () => {
      const r = suggestNextAction({
        internalStatus: "negociacao",
        daysSinceLastActivity: 8,
        daysInStage: 5,
        hasScheduledActivity: false,
      });
      expect(r?.label).toContain("Follow-up");
      expect(r?.urgency).toBe("medium");
    });
  });

  describe("etapa parada", () => {
    it(">=21 dias na etapa => Destravar etapa high", () => {
      const r = suggestNextAction({
        internalStatus: "negociacao",
        daysSinceLastActivity: 1,
        daysInStage: 30,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Destravar etapa");
      expect(r?.urgency).toBe("high");
    });

    it(">=14 e <21 dias na etapa => Acelerar negócio medium", () => {
      const r = suggestNextAction({
        internalStatus: "negociacao",
        daysSinceLastActivity: 1,
        daysInStage: 15,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Acelerar negócio");
      expect(r?.urgency).toBe("medium");
    });
  });

  describe("sugestões por etapa específica", () => {
    it("sent_to_client com >=3 dias => Confirmar leitura", () => {
      const r = suggestNextAction({
        internalStatus: "sent_to_client",
        daysSinceLastActivity: 4,
        daysInStage: 4,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Confirmar leitura");
    });

    it("minuta_solicitada com >=2 dias => Acompanhar minuta", () => {
      const r = suggestNextAction({
        internalStatus: "minuta_solicitada",
        daysSinceLastActivity: 3,
        daysInStage: 3,
        hasScheduledActivity: false,
      });
      expect(r?.label).toBe("Acompanhar minuta");
    });
  });

  it("retorna null quando tudo está em dia", () => {
    const r = suggestNextAction({
      internalStatus: "negociacao",
      daysSinceLastActivity: 1,
      daysInStage: 2,
      hasScheduledActivity: false,
    });
    expect(r).toBeNull();
  });
});
