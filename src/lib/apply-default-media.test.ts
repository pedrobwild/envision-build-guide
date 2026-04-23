import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Valida o guardrail centralizado: garante que orçamentos com upload
 * manual NUNCA recebem .update({ media_config }) durante a replicação.
 */

const updateCalls: Array<{ table: string; id: string; payload: unknown }> = [];
const selectResults = new Map<string, { media_config: unknown }>();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({
            data: selectResults.get(val) ?? { media_config: null },
            error: null,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_col: string, val: string) => {
          updateCalls.push({ table, id: val, payload });
          return { error: null };
        },
      }),
    }),
  },
}));

vi.mock("@/lib/default-media-policy", async (orig) => {
  const actual = await orig<typeof import("./default-media-policy")>();
  return {
    ...actual,
    resolveDefaultMedia: vi.fn(async () => ({
      media: {
        projeto3d: ["https://x/default-3d.png"],
        projetoExecutivo: [],
        fotos: [],
      },
      source: "hardcoded_fallback" as const,
    })),
  };
});

import { applyDefaultMediaWithGuardrail } from "./apply-default-media";

describe("apply-default-media guardrail", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    selectResults.clear();
  });

  it("PULA orçamento com video3d manual — sem update no DB", async () => {
    selectResults.set("budget-manual-video", {
      media_config: { video3d: "https://x/v.mp4" },
    });

    const result = await applyDefaultMediaWithGuardrail("budget-manual-video");

    expect(result).toEqual({ applied: false, reason: "manual_media_present" });
    expect(updateCalls).toEqual([]);
  });

  it("PULA orçamento com fotos manuais", async () => {
    selectResults.set("b1", { media_config: { fotos: ["https://x/f.jpg"] } });

    const result = await applyDefaultMediaWithGuardrail("b1");

    expect(result.applied).toBe(false);
    expect(updateCalls).toEqual([]);
  });

  it("PULA orçamento com projeto executivo manual", async () => {
    selectResults.set("b2", {
      media_config: { projetoExecutivo: ["https://x/e.png"] },
    });

    const result = await applyDefaultMediaWithGuardrail("b2");

    expect(result.applied).toBe(false);
    expect(updateCalls).toEqual([]);
  });

  it("PULA orçamento com projeto3d manual mesmo se template é informado", async () => {
    selectResults.set("b3", { media_config: { projeto3d: ["https://x/3d.png"] } });

    const result = await applyDefaultMediaWithGuardrail("b3", "template-id-123");

    expect(result.applied).toBe(false);
    expect(updateCalls).toEqual([]);
  });

  it("APLICA mídia padrão quando o orçamento não tem mídia", async () => {
    selectResults.set("vazio", { media_config: null });

    const result = await applyDefaultMediaWithGuardrail("vazio");

    expect(result.applied).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe("vazio");
    expect(updateCalls[0].table).toBe("budgets");
  });

  it("APLICA mídia padrão quando media_config é objeto vazio", async () => {
    selectResults.set("vazio2", { media_config: {} });

    const result = await applyDefaultMediaWithGuardrail("vazio2");

    expect(result.applied).toBe(true);
    expect(updateCalls).toHaveLength(1);
  });

  it("APLICA quando arrays existem mas estão vazios", async () => {
    selectResults.set("vazio3", {
      media_config: { projeto3d: [], fotos: [], projetoExecutivo: [] },
    });

    const result = await applyDefaultMediaWithGuardrail("vazio3");

    expect(result.applied).toBe(true);
    expect(updateCalls).toHaveLength(1);
  });

  it("guardrail é idempotente: 2 chamadas em manual = 0 updates", async () => {
    selectResults.set("manual-stable", {
      media_config: { fotos: ["https://x/f.jpg"] },
    });

    await applyDefaultMediaWithGuardrail("manual-stable");
    await applyDefaultMediaWithGuardrail("manual-stable");

    expect(updateCalls).toEqual([]);
  });
});
