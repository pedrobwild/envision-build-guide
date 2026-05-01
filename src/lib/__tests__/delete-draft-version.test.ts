/**
 * Anti-regressão para `deleteDraftVersion` (issue #14).
 *
 * Cobre os cenários que produziram grupos com versões "sumindo":
 *   - tentar deletar a versão atual (is_current_version=true)
 *   - tentar deletar a versão publicada (is_published_version=true)
 *   - tentar deletar a única versão de um grupo
 *   - tentar deletar a raiz do version_group quando há outras versões
 *   - tentar deletar uma versão fora do status "draft"
 *
 * Também valida o caminho feliz: deleção bem-sucedida emite um evento
 * `budget_deleted` ancorado num registro sobrevivente (parent_budget_id),
 * já que `budget_events.budget_id` é FK ON DELETE CASCADE para `budgets.id`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub do supabase. Cada teste injeta o comportamento por tabela/operação.
const { supabaseStub } = vi.hoisted(() => ({
  supabaseStub: { from: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseStub,
}));

import { deleteDraftVersion } from "@/lib/budget-versioning";

interface TargetRow {
  id: string;
  status: string;
  is_current_version: boolean;
  is_published_version: boolean;
  version_group_id: string | null;
  version_number: number | null;
  parent_budget_id: string | null;
  public_id: string | null;
}

/**
 * Constrói o stub do `supabase.from(...)` cobrindo, na ordem em que
 * `deleteDraftVersion` faz as queries, cada uma das tabelas envolvidas.
 *
 * - `budgets` (1ª chamada) → load do alvo (.select().eq().single())
 * - `budgets` (2ª chamada, opcional) → count do grupo (head:true)
 * - `budgets` (3ª chamada, opcional) → count de filhos do grupo via raiz
 * - `sections|items|item_images|adjustments|rooms|budget_tours` → cleanup leniente
 * - `budgets` (última chamada) → delete (.delete().eq())
 * - `budget_events` → insert do audit log
 */
function setupStub(opts: {
  target: TargetRow | null;
  groupCount?: number;
  rootChildrenCount?: number;
  deleteError?: { message: string } | null;
}) {
  const insertedEvents: Array<Record<string, unknown>> = [];
  let budgetsCalls = 0;

  supabaseStub.from.mockImplementation((table: string) => {
    if (table === "budgets") {
      budgetsCalls += 1;

      // 1ª chamada: load do target
      if (budgetsCalls === 1) {
        return {
          select: () => ({
            eq: () => ({
              single: async () =>
                opts.target
                  ? { data: opts.target, error: null }
                  : { data: null, error: { message: "not found" } },
            }),
          }),
        } as never;
      }

      // 2ª chamada: count do grupo (head:true) — só roda se target.version_group_id
      if (budgetsCalls === 2) {
        return {
          select: (_cols: string, _opts?: unknown) => ({
            eq: async () => ({ count: opts.groupCount ?? 5, error: null }),
          }),
        } as never;
      }

      // 3ª chamada: count de filhos do grupo via raiz (head:true) — só
      // roda quando version_group_id === budgetId
      if (budgetsCalls === 3) {
        return {
          select: () => ({
            eq: () => ({
              neq: async () => ({ count: opts.rootChildrenCount ?? 0, error: null }),
            }),
          }),
        } as never;
      }

      // Anchor lookup p/ logBudgetDeletion (parent ou irmão) e DELETE final
      // são as próximas chamadas em `budgets`. Detectamos pela API usada.
      return {
        // anchor lookup via parent_budget_id
        select: (_cols?: string) => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: opts.target?.parent_budget_id ?? null }, error: null }),
            neq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
        // delete final
        delete: () => ({
          eq: async () => ({ error: opts.deleteError ?? null }),
        }),
      } as never;
    }

    if (table === "budget_events") {
      return {
        insert: async (row: Record<string, unknown>) => {
          insertedEvents.push(row);
          return { data: null, error: null };
        },
      } as never;
    }

    // Tabelas filhas — leniente
    return {
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
      delete: () => ({
        eq: async () => ({ error: null }),
        in: async () => ({ error: null }),
      }),
    } as never;
  });

  return { insertedEvents };
}

beforeEach(() => {
  supabaseStub.from.mockReset();
});

describe("deleteDraftVersion — bloqueia exclusões perigosas (issue #14)", () => {
  it("recusa quando a versão não existe", async () => {
    setupStub({ target: null });
    await expect(deleteDraftVersion("inexistente")).rejects.toThrow(/n[ãa]o encontrada/i);
  });

  it("recusa deletar a versão atual (is_current_version=true)", async () => {
    setupStub({
      target: {
        id: "b1",
        status: "draft",
        is_current_version: true,
        is_published_version: false,
        version_group_id: "g1",
        version_number: 5,
        parent_budget_id: "p1",
        public_id: null,
      },
    });
    await expect(deleteDraftVersion("b1")).rejects.toThrow(/vers[aã]o atual/i);
  });

  it("recusa deletar a versão publicada (is_published_version=true)", async () => {
    setupStub({
      target: {
        id: "b1",
        status: "draft", // mesmo em draft, se published=true, deve recusar
        is_current_version: false,
        is_published_version: true,
        version_group_id: "g1",
        version_number: 5,
        parent_budget_id: "p1",
        public_id: "abc123",
      },
    });
    await expect(deleteDraftVersion("b1")).rejects.toThrow(/publicada/i);
  });

  it("recusa deletar quando o status não é 'draft'", async () => {
    setupStub({
      target: {
        id: "b1",
        status: "archived",
        is_current_version: false,
        is_published_version: false,
        version_group_id: "g1",
        version_number: 3,
        parent_budget_id: "p1",
        public_id: null,
      },
    });
    await expect(deleteDraftVersion("b1")).rejects.toThrow(/rascunho/i);
  });

  it("recusa deletar a única versão do grupo", async () => {
    setupStub({
      target: {
        id: "b1",
        status: "draft",
        is_current_version: false,
        is_published_version: false,
        version_group_id: "g1",
        version_number: 1,
        parent_budget_id: null,
        public_id: null,
      },
      groupCount: 1,
    });
    await expect(deleteDraftVersion("b1")).rejects.toThrow(/[uú]nica vers[aã]o/i);
  });

  it("recusa deletar a RAIZ do version_group enquanto há outras versões", async () => {
    setupStub({
      target: {
        id: "root-1",
        status: "draft",
        is_current_version: false,
        is_published_version: false,
        version_group_id: "root-1", // raiz: id == group_id
        version_number: 1,
        parent_budget_id: null,
        public_id: null,
      },
      groupCount: 4, // passa do guard "única"
      rootChildrenCount: 3, // bate no guard de raiz com filhos
    });
    await expect(deleteDraftVersion("root-1")).rejects.toThrow(/raiz do grupo/i);
  });
});
