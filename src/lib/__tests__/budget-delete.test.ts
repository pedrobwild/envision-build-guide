/**
 * Anti-regressão para `safeDeleteBudget` (soft-delete).
 *
 * Cobre as proteções restantes após a migração para soft-delete em 2026-05-01:
 *  - inexistente
 *  - já está na lixeira
 *  - é a versão atual
 *  - é a versão publicada
 *  - happy path: marca deleted_at
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { supabaseStub } = vi.hoisted(() => ({
  supabaseStub: {
    from: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })) },
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseStub,
}));

import { safeDeleteBudget } from "@/lib/budget-delete";

beforeEach(() => {
  supabaseStub.from.mockReset();
});

function mockBudgetsTable(target: unknown, opts: { updateError?: unknown } = {}) {
  supabaseStub.from.mockImplementation((table: string) => {
    if (table !== "budgets") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: target, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: opts.updateError ?? null }),
      }),
    } as never;
  });
}

describe("safeDeleteBudget — soft-delete", () => {
  it("recusa quando o budget não existe", async () => {
    mockBudgetsTable(null);
    const r = await safeDeleteBudget("inexistente");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/n[ãa]o encontrado/i);
  });

  it("recusa quando já está na lixeira", async () => {
    mockBudgetsTable({
      id: "b1",
      status: "draft",
      is_current_version: false,
      is_published_version: false,
      deleted_at: "2026-05-01T00:00:00Z",
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/lixeira/i);
  });

  it("recusa mover a versão atual para a lixeira", async () => {
    mockBudgetsTable({
      id: "b1",
      status: "draft",
      is_current_version: true,
      is_published_version: false,
      deleted_at: null,
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/vers[aã]o atual/i);
  });

  it("recusa mover a versão publicada para a lixeira", async () => {
    mockBudgetsTable({
      id: "b1",
      status: "published",
      is_current_version: false,
      is_published_version: true,
      deleted_at: null,
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/publicada/i);
  });

  it("happy path: marca deleted_at quando passa nas checagens", async () => {
    mockBudgetsTable({
      id: "b1",
      status: "draft",
      is_current_version: false,
      is_published_version: false,
      deleted_at: null,
    });
    const r = await safeDeleteBudget("b1");
    expect(r.ok).toBe(true);
  });
});
