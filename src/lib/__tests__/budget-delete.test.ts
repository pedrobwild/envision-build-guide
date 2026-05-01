/**
 * Anti-regressão para `safeDeleteBudget`.
 *
 * Cobre os 3 estados que produziram os 45 budgets órfãos no banco em 2026-04-30:
 *  - tentar deletar a versão atual
 *  - tentar deletar a versão publicada
 *  - tentar deletar a raiz do version_group quando ainda há filhos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do client supabase. Cada teste injeta um stub específico.
// Usamos vi.hoisted para garantir que o stub exista antes do vi.mock ser içado.
const { supabaseStub } = vi.hoisted(() => ({
  supabaseStub: { from: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseStub,
}));

import { safeDeleteBudget } from "@/lib/budget-delete";

beforeEach(() => {
  supabaseStub.from.mockReset();
});

/** Builder util que monta um chain mock para uma única tabela com retornos pré-definidos. */
function mockTable(returns: {
  loadTarget?: { data: unknown; error: unknown };
  childCount?: { count: number; error: unknown };
  groupCount?: { count: number; error: unknown };
}) {
  let call = 0;
  supabaseStub.from.mockImplementation((table: string) => {
    if (table === "budgets") {
      call += 1;
      if (call === 1 && returns.loadTarget) {
        // 1ª chamada: load target
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => returns.loadTarget!,
            }),
          }),
        } as never;
      }
      if (call === 2 && returns.childCount) {
        // 2ª chamada: count filhos por parent_budget_id
        return {
          select: () => ({
            eq: async () => returns.childCount!,
          }),
        } as never;
      }
      if (call === 3 && returns.groupCount) {
        // 3ª chamada: count membros do grupo
        return {
          select: () => ({
            eq: () => ({
              neq: async () => returns.groupCount!,
            }),
          }),
        } as never;
      }
    }
    // tabelas filhas — sempre retornam vazio / sucesso (chain leniente)
    const noop = () => ({
      eq: () => ({
        in: async () => ({ data: [], error: null }),
      }),
      in: async () => ({ data: [], error: null }),
    });
    return {
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
      delete: () => ({
        eq: async () => ({ error: null }),
        in: async () => ({ error: null }),
      }),
      ...noop(),
    } as never;
  });
}

describe("safeDeleteBudget — bloqueia exclusões perigosas", () => {
  it("recusa quando o budget não existe", async () => {
    mockTable({ loadTarget: { data: null, error: null } });
    const r = await safeDeleteBudget("inexistente");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/n[ãa]o encontrado/i);
  });

  it("recusa deletar versão atual (is_current_version=true)", async () => {
    mockTable({
      loadTarget: {
        data: {
          id: "b1",
          status: "draft",
          is_current_version: true,
          is_published_version: false,
          version_group_id: "g1",
        },
        error: null,
      },
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/vers[aã]o atual/i);
  });

  it("recusa deletar versão publicada (is_published_version=true)", async () => {
    mockTable({
      loadTarget: {
        data: {
          id: "b1",
          status: "published",
          is_current_version: false,
          is_published_version: true,
          version_group_id: "g1",
        },
        error: null,
      },
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/publicada/i);
  });

  it("recusa deletar a RAIZ do version_group quando ainda há filhos no grupo", async () => {
    mockTable({
      loadTarget: {
        data: {
          id: "root-1",
          status: "archived",
          is_current_version: false,
          is_published_version: false,
          version_group_id: "root-1", // raiz: id == group_id
        },
        error: null,
      },
      childCount: { count: 0, error: null }, // ninguém aponta como parent
      groupCount: { count: 3, error: null }, // 3 outros membros do grupo
    });
    const r = await safeDeleteBudget("root-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/raiz do grupo/i);
  });

  it("recusa quando outros budgets dependem deste como parent_budget_id", async () => {
    mockTable({
      loadTarget: {
        data: {
          id: "b1",
          status: "archived",
          is_current_version: false,
          is_published_version: false,
          version_group_id: "g1",
        },
        error: null,
      },
      childCount: { count: 2, error: null },
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/vers[aã]o\(/i);
  });
});
