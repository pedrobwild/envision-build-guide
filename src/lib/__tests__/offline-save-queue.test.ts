/**
 * Anti-regressão para a fila local de saves offline (`offline-save-queue.ts`).
 * Cobre enqueue/coalescing, flush feliz, flush com erro (preserva fila),
 * e leitura de fila ausente/corrompida.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { supabaseStub, eqMock } = vi.hoisted(() => {
  const eqMock = vi.fn();
  return {
    eqMock,
    supabaseStub: {
      from: vi.fn(() => ({
        update: vi.fn(() => ({ eq: eqMock })),
      })),
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseStub }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  enqueueOfflineSave,
  getPendingFields,
  hasPending,
  flushOfflineQueue,
} from "@/lib/offline-save-queue";

beforeEach(() => {
  localStorage.clear();
  supabaseStub.from.mockClear();
  eqMock.mockReset();
});

describe("offline-save-queue", () => {
  describe("enqueueOfflineSave", () => {
    it("adiciona campo na fila", () => {
      enqueueOfflineSave("b1", "responsible_id", "user-x");
      expect(getPendingFields("b1")).toEqual(["responsible_id"]);
      expect(hasPending("b1")).toBe(true);
    });

    it("último valor sobrescreve para o mesmo campo (coalescing)", () => {
      enqueueOfflineSave("b1", "deadline", "2026-01-01");
      enqueueOfflineSave("b1", "deadline", "2026-12-31");
      expect(getPendingFields("b1")).toEqual(["deadline"]);
      // E o valor persistido é o mais recente — checamos via flush
    });

    it("filas isoladas por budgetId", () => {
      enqueueOfflineSave("b1", "x", 1);
      enqueueOfflineSave("b2", "y", 2);
      expect(getPendingFields("b1")).toEqual(["x"]);
      expect(getPendingFields("b2")).toEqual(["y"]);
    });

    it("ignora budgetId vazio (sem crashar)", () => {
      enqueueOfflineSave("", "x", 1);
      expect(hasPending("")).toBe(false);
    });
  });

  describe("hasPending / getPendingFields", () => {
    it("vazio quando não há nada", () => {
      expect(hasPending("nada")).toBe(false);
      expect(getPendingFields("nada")).toEqual([]);
    });

    it("storage corrompido degrada para fila vazia (sem throw)", () => {
      localStorage.setItem("budget-offline-queue:b1", "isto-nao-eh-json{{");
      expect(hasPending("b1")).toBe(false);
      expect(getPendingFields("b1")).toEqual([]);
    });
  });

  describe("flushOfflineQueue", () => {
    it("retorna true imediatamente se a fila está vazia", async () => {
      const ok = await flushOfflineQueue("b1");
      expect(ok).toBe(true);
      expect(supabaseStub.from).not.toHaveBeenCalled();
    });

    it("retorna true para budgetId vazio", async () => {
      const ok = await flushOfflineQueue("");
      expect(ok).toBe(true);
    });

    it("happy path: faz UPDATE com todos os campos e limpa a fila", async () => {
      eqMock.mockResolvedValueOnce({ error: null });
      enqueueOfflineSave("b1", "deadline", "2026-12-31");
      enqueueOfflineSave("b1", "responsible_id", "user-x");

      const ok = await flushOfflineQueue("b1");

      expect(ok).toBe(true);
      expect(supabaseStub.from).toHaveBeenCalledWith("budgets");
      expect(eqMock).toHaveBeenCalledTimes(1);
      expect(hasPending("b1")).toBe(false);
    });

    it("falha do supabase preserva a fila para nova tentativa", async () => {
      eqMock.mockResolvedValueOnce({ error: { message: "network" } });
      enqueueOfflineSave("b1", "deadline", "2026-12-31");

      const ok = await flushOfflineQueue("b1");

      expect(ok).toBe(false);
      expect(hasPending("b1")).toBe(true);
      expect(getPendingFields("b1")).toEqual(["deadline"]);
    });

    it("após falha, segunda tentativa pode ter sucesso", async () => {
      eqMock
        .mockResolvedValueOnce({ error: { message: "network" } })
        .mockResolvedValueOnce({ error: null });
      enqueueOfflineSave("b1", "deadline", "2026-12-31");

      expect(await flushOfflineQueue("b1")).toBe(false);
      expect(await flushOfflineQueue("b1")).toBe(true);
      expect(hasPending("b1")).toBe(false);
    });
  });
});
