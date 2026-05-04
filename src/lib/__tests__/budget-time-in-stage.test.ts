import { describe, it, expect } from "vitest";
import { computeBudgetTime, type StatusChangeEvent } from "@/lib/budget-time-in-stage";

const NOW = new Date("2026-05-04T12:00:00Z");

function ev(to: string, daysAgo: number, event_type = "status_change"): StatusChangeEvent {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { event_type, to_status: to, created_at: d.toISOString() };
}
function iso(daysAgo: number) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

describe("computeBudgetTime", () => {
  it("conta desde a criação quando não há eventos de status", () => {
    const r = computeBudgetTime({
      internalStatus: "novo",
      createdAt: iso(7),
      events: [],
      now: NOW,
    });
    expect(r.isFrozen).toBe(false);
    expect(r.totalDaysOpen).toBe(7);
    expect(r.daysInStage).toBe(7);
    expect(r.frozenAt).toBeNull();
  });

  it("usa o último status_change que entrou no status atual como início da etapa", () => {
    const events = [
      ev("triage", 10),
      ev("in_progress", 6),
      ev("waiting_info", 4),
      ev("in_progress", 2), // re-entrou no status atual
    ];
    const r = computeBudgetTime({
      internalStatus: "in_progress",
      createdAt: iso(15),
      events,
      now: NOW,
    });
    expect(r.totalDaysOpen).toBe(15);
    expect(r.daysInStage).toBe(2);
  });

  it("congela no PRIMEIRO status_change para contrato_fechado, ignorando eventos posteriores", () => {
    const events = [
      ev("in_progress", 20),
      ev("delivered_to_sales", 10),
      ev("contrato_fechado", 5), // congela aqui
      ev("contrato_fechado", 1), // evento posterior NÃO conta
    ];
    const r = computeBudgetTime({
      internalStatus: "contrato_fechado",
      createdAt: iso(30),
      events,
      now: NOW,
    });
    expect(r.isFrozen).toBe(true);
    expect(r.frozenAt?.toISOString()).toBe(iso(5));
    // 30 dias criado, congelou há 5 → 25 dias abertos
    expect(r.totalDaysOpen).toBe(25);
  });

  it("congela em lost", () => {
    const events = [ev("in_progress", 10), ev("lost", 3)];
    const r = computeBudgetTime({
      internalStatus: "lost",
      createdAt: iso(12),
      events,
      now: NOW,
    });
    expect(r.isFrozen).toBe(true);
    expect(r.totalDaysOpen).toBe(9); // 12 - 3
  });

  it("congela em archived", () => {
    const events = [ev("archived", 2)];
    const r = computeBudgetTime({
      internalStatus: "archived",
      createdAt: iso(8),
      events,
      now: NOW,
    });
    expect(r.isFrozen).toBe(true);
    expect(r.totalDaysOpen).toBe(6);
  });

  it("daysInStage usa o evento de entrada no estado final como início da etapa", () => {
    const events = [
      ev("in_progress", 10),
      ev("delivered_to_sales", 5),
      ev("contrato_fechado", 3),
    ];
    const r = computeBudgetTime({
      internalStatus: "contrato_fechado",
      createdAt: iso(20),
      events,
      now: NOW,
    });
    // congela em -3, entrou no estado em -3 → 0 dias na etapa
    expect(r.daysInStage).toBe(0);
  });

  it("ignora eventos não-status_change ao identificar congelamento", () => {
    const events: StatusChangeEvent[] = [
      ev("in_progress", 10),
      { event_type: "comment", to_status: "contrato_fechado", created_at: iso(8) }, // ruído
      ev("contrato_fechado", 4),
    ];
    const r = computeBudgetTime({
      internalStatus: "contrato_fechado",
      createdAt: iso(15),
      events,
      now: NOW,
    });
    expect(r.frozenAt?.toISOString()).toBe(iso(4));
    expect(r.totalDaysOpen).toBe(11);
  });

  it("retorna 0 (hoje) quando criado e movido no mesmo dia", () => {
    const events = [ev("in_progress", 0)];
    const r = computeBudgetTime({
      internalStatus: "in_progress",
      createdAt: iso(0),
      events,
      now: NOW,
    });
    expect(r.totalDaysOpen).toBe(0);
    expect(r.daysInStage).toBe(0);
  });

  it("retorna nulls quando createdAt é null e não há eventos", () => {
    const r = computeBudgetTime({
      internalStatus: "novo",
      createdAt: null,
      events: [],
      now: NOW,
    });
    expect(r.totalDaysOpen).toBeNull();
    expect(r.daysInStage).toBeNull();
  });

  it("não fica negativo se eventos forem futuros (defensivo)", () => {
    const future = new Date(NOW);
    future.setUTCDate(future.getUTCDate() + 5);
    const events: StatusChangeEvent[] = [
      { event_type: "status_change", to_status: "in_progress", created_at: future.toISOString() },
    ];
    const r = computeBudgetTime({
      internalStatus: "in_progress",
      createdAt: iso(2),
      events,
      now: NOW,
    });
    expect(r.daysInStage).toBe(0);
  });

  it("estado atual não-final ignora eventos finais antigos (cronômetro destrava se voltou)", () => {
    // Cenário raro: foi para contrato_fechado e depois voltou para in_progress.
    // O internal_status atual NÃO está congelado, então não há frozenAt.
    const events = [
      ev("contrato_fechado", 8),
      ev("in_progress", 2),
    ];
    const r = computeBudgetTime({
      internalStatus: "in_progress",
      createdAt: iso(15),
      events,
      now: NOW,
    });
    expect(r.isFrozen).toBe(false);
    expect(r.frozenAt).toBeNull();
    expect(r.totalDaysOpen).toBe(15);
    expect(r.daysInStage).toBe(2);
  });
});
