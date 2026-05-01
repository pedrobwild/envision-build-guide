/**
 * Anti-regressão para `deleteDraftVersion` (hard-delete de versões em rascunho).
 *
 * Cobre as proteções e a auditoria obrigatória descrita na issue #14:
 *  - recusa quando o budget não existe
 *  - recusa quando o status NÃO é 'draft'
 *  - recusa quando é a versão atual (is_current_version=true)
 *  - recusa quando é a versão publicada (is_published_version=true)
 *  - recusa quando é a única versão do grupo
 *  - happy path: registra `version_deleted` em um IRMÃO antes do DELETE
 *    (porque budget_events.budget_id tem ON DELETE CASCADE — registrar no
 *    próprio budget destruiria o evento junto)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface VersionEventArg {
  event_type: string;
  budget_id: string;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}

const { supabaseStub, logVersionEventMock } = vi.hoisted(() => ({
  supabaseStub: {
    from: vi.fn(),
  },
  logVersionEventMock: vi.fn(async (_arg: VersionEventArg) => undefined),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseStub,
}));

vi.mock("@/lib/version-audit", () => ({
  logVersionEvent: logVersionEventMock,
}));

import { deleteDraftVersion } from "@/lib/budget-versioning";

interface BudgetRow {
  id: string;
  status: string;
  is_current_version: boolean;
  is_published_version: boolean;
  version_group_id: string | null;
  version_number: number | null;
  public_id: string | null;
  parent_budget_id: string | null;
  change_reason: string | null;
}

interface MockOptions {
  target: BudgetRow | null;
  loadError?: unknown;
  siblings?: Array<{ id: string; version_number: number | null }>;
  /** Captura inserts e deletes para asserções */
  captured?: {
    deletedTables: string[];
  };
}

function buildBudgetsMock(opts: MockOptions) {
  const { target, loadError, siblings = [] } = opts;
  const captured = opts.captured;

  // The implementation issues, in order:
  //  1) supabase.from("budgets").select("...").eq("id", id).single()    ← target
  //  2) supabase.from("budgets").select(...).eq(...).neq(...).order(...).limit(1)  ← siblings
  //  3) supabase.from("sections").select("id").eq("budget_id", id)       ← []
  //  4) supabase.from("adjustments").delete().eq(...)
  //  5) supabase.from("rooms").delete().eq(...)
  //  6) supabase.from("budget_tours").delete().eq(...)
  //  7) supabase.from("budgets").delete().eq("id", id)
  let budgetsSelectCall = 0;

  return (table: string) => {
    if (table === "budgets") {
      return {
        select: () => {
          budgetsSelectCall += 1;
          if (budgetsSelectCall === 1) {
            // load target
            return {
              eq: () => ({
                single: async () => ({ data: target, error: loadError ?? null }),
              }),
            };
          }
          // siblings query
          return {
            eq: () => ({
              neq: () => ({
                order: () => ({
                  limit: async () => ({ data: siblings, error: null }),
                }),
              }),
            }),
          };
        },
        delete: () => ({
          eq: async () => {
            captured?.deletedTables.push("budgets");
            return { error: null };
          },
        }),
      } as never;
    }
    if (table === "sections") {
      return {
        select: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
        delete: () => ({
          in: async () => ({ error: null }),
        }),
      } as never;
    }
    if (table === "adjustments" || table === "rooms" || table === "budget_tours") {
      return {
        delete: () => ({
          eq: async () => {
            captured?.deletedTables.push(table);
            return { error: null };
          },
        }),
      } as never;
    }
    throw new Error(`Unexpected table in deleteDraftVersion test: ${table}`);
  };
}

beforeEach(() => {
  supabaseStub.from.mockReset();
  logVersionEventMock.mockReset();
  logVersionEventMock.mockResolvedValue(undefined);
});

describe("deleteDraftVersion — safety checks", () => {
  it("recusa quando o budget não existe", async () => {
    supabaseStub.from.mockImplementation(buildBudgetsMock({ target: null }));
    await expect(deleteDraftVersion("missing")).rejects.toThrow(/Vers[aã]o n[aã]o encontrada/i);
    expect(logVersionEventMock).not.toHaveBeenCalled();
  });

  it("recusa quando status != 'draft'", async () => {
    supabaseStub.from.mockImplementation(
      buildBudgetsMock({
        target: {
          id: "v2",
          status: "published",
          is_current_version: false,
          is_published_version: false,
          version_group_id: "grp",
          version_number: 2,
          public_id: null,
          parent_budget_id: "v1",
          change_reason: null,
        },
      })
    );
    await expect(deleteDraftVersion("v2")).rejects.toThrow(/rascunho/i);
    expect(logVersionEventMock).not.toHaveBeenCalled();
  });

  it("recusa excluir a versão ATUAL", async () => {
    supabaseStub.from.mockImplementation(
      buildBudgetsMock({
        target: {
          id: "v3",
          status: "draft",
          is_current_version: true,
          is_published_version: false,
          version_group_id: "grp",
          version_number: 3,
          public_id: null,
          parent_budget_id: "v2",
          change_reason: null,
        },
      })
    );
    await expect(deleteDraftVersion("v3")).rejects.toThrow(/vers[aã]o atual/i);
    expect(logVersionEventMock).not.toHaveBeenCalled();
  });

  it("recusa excluir a versão PUBLICADA", async () => {
    supabaseStub.from.mockImplementation(
      buildBudgetsMock({
        target: {
          id: "v3",
          status: "draft",
          is_current_version: false,
          is_published_version: true,
          version_group_id: "grp",
          version_number: 3,
          public_id: "pub-3",
          parent_budget_id: "v2",
          change_reason: null,
        },
      })
    );
    await expect(deleteDraftVersion("v3")).rejects.toThrow(/publicada/i);
    expect(logVersionEventMock).not.toHaveBeenCalled();
  });

  it("recusa excluir a ÚNICA versão do grupo", async () => {
    supabaseStub.from.mockImplementation(
      buildBudgetsMock({
        target: {
          id: "v1",
          status: "draft",
          is_current_version: false,
          is_published_version: false,
          version_group_id: "grp",
          version_number: 1,
          public_id: null,
          parent_budget_id: null,
          change_reason: null,
        },
        siblings: [], // nenhum irmão
      })
    );
    await expect(deleteDraftVersion("v1")).rejects.toThrow(/[uú]nica vers[aã]o/i);
    expect(logVersionEventMock).not.toHaveBeenCalled();
  });
});

describe("deleteDraftVersion — happy path com auditoria", () => {
  it("registra version_deleted em um IRMÃO antes do DELETE", async () => {
    const captured = { deletedTables: [] as string[] };
    supabaseStub.from.mockImplementation(
      buildBudgetsMock({
        target: {
          id: "v3",
          status: "draft",
          is_current_version: false,
          is_published_version: false,
          version_group_id: "grp-xyz",
          version_number: 3,
          public_id: null,
          parent_budget_id: "v2",
          change_reason: "Ajuste de escopo",
        },
        siblings: [{ id: "v1-survivor", version_number: 1 }],
        captured,
      })
    );

    await deleteDraftVersion("v3", "user-99");

    // Auditoria registrada em irmão sobrevivente
    expect(logVersionEventMock).toHaveBeenCalledTimes(1);
    const call = (logVersionEventMock.mock.calls[0] ?? [])[0] as unknown as VersionEventArg;
    expect(call.event_type).toBe("version_deleted");
    expect(call.budget_id).toBe("v1-survivor");
    expect(call.user_id).toBe("user-99");
    expect(call.metadata).toMatchObject({
      deleted_budget_id: "v3",
      deleted_version_number: 3,
      deleted_change_reason: "Ajuste de escopo",
      version_group_id: "grp-xyz",
    });

    // Deletes ocorreram (não houve early-return)
    expect(captured.deletedTables).toContain("budgets");
  });
});
