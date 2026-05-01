/**
 * Anti-regressão: versão publicada NUNCA recebe escrita silenciosa
 * via offline queue.
 *
 * Cenário real que motivou estes testes (2026-05-01):
 *  - Usuário edita campos do orçamento offline → enfileirados em localStorage.
 *  - Mais tarde publica o orçamento (ou outro usuário publica essa versão).
 *  - Ao reabrir, o useEffect de flush rodava SEM checar is_published_version
 *    e gravava direto no snapshot público — alterando o que o cliente via.
 *
 * Este arquivo trava a política em três níveis:
 *  1) `decideOfflineFlush` decide "discard" para versão publicada
 *  2) `applyOfflineFlushDecision` chama discardOfflineQueue, NUNCA flushOfflineQueue
 *  3) `discardOfflineQueue` esvazia a fila in-place
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { supabaseStub } = vi.hoisted(() => ({
  supabaseStub: {
    from: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseStub,
}));

import {
  enqueueOfflineSave,
  discardOfflineQueue,
  hasPending,
  getPendingFields,
  flushOfflineQueue,
} from "@/lib/offline-save-queue";
import {
  decideOfflineFlush,
  applyOfflineFlushDecision,
} from "@/lib/published-protection";

const BUDGET_ID = "budget-pub-1";

beforeEach(() => {
  localStorage.clear();
  supabaseStub.from.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe("decideOfflineFlush — política pura", () => {
  it("skip quando não há budgetId", () => {
    const d = decideOfflineFlush({ budgetId: null, isPublishedVersion: false });
    expect(d).toEqual({ action: "skip", reason: "no-budget-id" });
  });

  it("skip quando não há fila pendente", () => {
    const d = decideOfflineFlush({
      budgetId: BUDGET_ID,
      isPublishedVersion: false,
      hasPendingFn: () => false,
    });
    expect(d).toEqual({ action: "skip", reason: "no-pending" });
  });

  it("DESCARTA quando é versão publicada — mesmo com fila pendente", () => {
    const d = decideOfflineFlush({
      budgetId: BUDGET_ID,
      isPublishedVersion: true,
      hasPendingFn: () => true,
    });
    expect(d).toEqual({ action: "discard", reason: "published-version" });
  });

  it("flush apenas quando NÃO é publicada e há pendência", () => {
    const d = decideOfflineFlush({
      budgetId: BUDGET_ID,
      isPublishedVersion: false,
      hasPendingFn: () => true,
    });
    expect(d).toEqual({ action: "flush" });
  });
});

describe("discardOfflineQueue — esvazia a fila local sem rede", () => {
  it("limpa todos os campos pendentes", () => {
    enqueueOfflineSave(BUDGET_ID, "client_name", "Foo Bar");
    enqueueOfflineSave(BUDGET_ID, "manual_total", 12345);
    expect(hasPending(BUDGET_ID)).toBe(true);
    expect(getPendingFields(BUDGET_ID).sort()).toEqual(["client_name", "manual_total"]);

    discardOfflineQueue(BUDGET_ID);

    expect(hasPending(BUDGET_ID)).toBe(false);
    expect(getPendingFields(BUDGET_ID)).toEqual([]);
  });

  it("é idempotente e seguro com budgetId vazio", () => {
    expect(() => discardOfflineQueue("")).not.toThrow();
    expect(() => discardOfflineQueue(BUDGET_ID)).not.toThrow();
  });

  it("não toca em filas de OUTROS orçamentos", () => {
    enqueueOfflineSave(BUDGET_ID, "client_name", "A");
    enqueueOfflineSave("other-budget", "client_name", "B");

    discardOfflineQueue(BUDGET_ID);

    expect(hasPending(BUDGET_ID)).toBe(false);
    expect(hasPending("other-budget")).toBe(true);
  });
});

describe("applyOfflineFlushDecision — efeito real", () => {
  it("versão publicada: descarta e NUNCA chama supabase.from('budgets').update", async () => {
    enqueueOfflineSave(BUDGET_ID, "client_name", "Cliente Antigo");
    enqueueOfflineSave(BUDGET_ID, "prazo_dias_uteis", 999);
    expect(hasPending(BUDGET_ID)).toBe(true);

    const result = await applyOfflineFlushDecision({
      budgetId: BUDGET_ID,
      isPublishedVersion: true,
    });

    expect(result.decision).toEqual({
      action: "discard",
      reason: "published-version",
    });
    // Crítico: nenhuma chamada à tabela budgets foi disparada
    expect(supabaseStub.from).not.toHaveBeenCalled();
    // Fila foi limpa para não voltar a tentar
    expect(hasPending(BUDGET_ID)).toBe(false);
  });

  it("rascunho não publicado: flush envia UPDATE para budgets", async () => {
    enqueueOfflineSave(BUDGET_ID, "client_name", "Novo Nome");

    const updateMock = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    supabaseStub.from.mockReturnValue({ update: updateMock });

    const result = await applyOfflineFlushDecision({
      budgetId: BUDGET_ID,
      isPublishedVersion: false,
    });

    expect(result.decision).toEqual({ action: "flush" });
    expect(result.flushed).toBe(true);
    expect(supabaseStub.from).toHaveBeenCalledWith("budgets");
    expect(updateMock).toHaveBeenCalledWith({ client_name: "Novo Nome" });
    expect(hasPending(BUDGET_ID)).toBe(false);
  });

  it("sem pendências: skip e NUNCA toca em supabase nem em localStorage", async () => {
    const result = await applyOfflineFlushDecision({
      budgetId: BUDGET_ID,
      isPublishedVersion: true,
    });
    expect(result.decision).toEqual({ action: "skip", reason: "no-pending" });
    expect(supabaseStub.from).not.toHaveBeenCalled();
  });

  it("regressão: cenário real — fila criada antes da publicação NUNCA vaza para a versão pública", async () => {
    // Estado A: orçamento ainda em rascunho, usuário edita offline
    enqueueOfflineSave(BUDGET_ID, "manual_total", 50000);
    enqueueOfflineSave(BUDGET_ID, "prazo_dias_uteis", 30);

    // Estado B: orçamento foi publicado nesse meio tempo (mesmo budget_id)
    // — agora reabrindo o editor com isPublishedVersion=true
    const result = await applyOfflineFlushDecision({
      budgetId: BUDGET_ID,
      isPublishedVersion: true,
    });

    expect(result.decision.action).toBe("discard");
    expect(supabaseStub.from).not.toHaveBeenCalled();
    // Snapshot público preservado: nada foi gravado
    // Fila esvaziada para não atacar em futuras montagens
    expect(hasPending(BUDGET_ID)).toBe(false);
  });
});

describe("flushOfflineQueue isolado — comportamento legado", () => {
  it("aceita flush direto, mas não é chamado pela política para publicada", async () => {
    enqueueOfflineSave(BUDGET_ID, "client_name", "X");
    const updateMock = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));
    supabaseStub.from.mockReturnValue({ update: updateMock });

    const ok = await flushOfflineQueue(BUDGET_ID);
    expect(ok).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });
});
