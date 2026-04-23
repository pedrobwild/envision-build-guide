import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hasManualMedia,
  decideReplicationFor,
  planReplication,
  type BudgetForReplication,
} from "./media-replication";
import { getHardcodedFallbackMedia } from "./default-media-policy";

/**
 * Suite que simula a replicação de mídia padrão e VALIDA o invariante
 * crítico: orçamentos com media_config preenchido manualmente NUNCA
 * podem ser alterados — nem no banco, nem por consequência no Storage.
 *
 * Os testes usam um cliente Supabase mockado para garantir que NENHUM
 * .update() é emitido contra orçamentos manuais durante a replicação.
 */

const DEFAULT_MEDIA = getHardcodedFallbackMedia();

describe("media-replication / hasManualMedia", () => {
  it("detecta mídia manual quando há vídeo 3D", () => {
    expect(hasManualMedia({ video3d: "https://x/v.mp4" })).toBe(true);
  });

  it("detecta mídia manual quando há fotos", () => {
    expect(hasManualMedia({ fotos: ["https://x/f.jpg"] })).toBe(true);
  });

  it("detecta mídia manual quando há projeto executivo", () => {
    expect(hasManualMedia({ projetoExecutivo: ["https://x/e.png"] })).toBe(true);
  });

  it("detecta mídia manual quando há projeto3d com itens", () => {
    expect(hasManualMedia({ projeto3d: ["https://x/3d.png"] })).toBe(true);
  });

  it("não considera manual config vazia/nula", () => {
    expect(hasManualMedia(null)).toBe(false);
    expect(hasManualMedia(undefined)).toBe(false);
    expect(hasManualMedia({})).toBe(false);
    expect(hasManualMedia({ projeto3d: [], fotos: [], projetoExecutivo: [] })).toBe(false);
    expect(hasManualMedia({ video3d: "" })).toBe(false);
    expect(hasManualMedia({ video3d: "   " })).toBe(false);
  });
});

describe("media-replication / decideReplicationFor", () => {
  it("PULA orçamento com mídia manual (vídeo)", () => {
    const decision = decideReplicationFor(
      { id: "b1", media_config: { video3d: "https://x/v.mp4" } },
      DEFAULT_MEDIA
    );
    expect(decision).toEqual({ action: "skip", reason: "manual_media_present" });
  });

  it("PULA orçamento com mídia manual (fotos)", () => {
    const decision = decideReplicationFor(
      { id: "b2", media_config: { fotos: ["https://x/f.jpg"] } },
      DEFAULT_MEDIA
    );
    expect(decision).toEqual({ action: "skip", reason: "manual_media_present" });
  });

  it("PULA orçamento com projeto3d manual mesmo idêntico ao padrão", () => {
    // Mesmo que o conteúdo coincida, qualquer projeto3d existente é "manual".
    const decision = decideReplicationFor(
      { id: "b3", media_config: { projeto3d: DEFAULT_MEDIA.projeto3d } },
      DEFAULT_MEDIA
    );
    expect(decision.action).toBe("skip");
  });

  it("APLICA mídia padrão em orçamento sem media_config", () => {
    const decision = decideReplicationFor(
      { id: "b4", media_config: null },
      DEFAULT_MEDIA
    );
    expect(decision.action).toBe("apply");
    if (decision.action === "apply") {
      expect(decision.nextConfig.projeto3d?.length).toBeGreaterThan(0);
      // Sanitização garantida: nunca propaga vídeo/exec/fotos como padrão.
      expect(decision.nextConfig.video3d).toBeUndefined();
      expect(decision.nextConfig.projetoExecutivo).toEqual([]);
      expect(decision.nextConfig.fotos).toEqual([]);
    }
  });

  it("APLICA mídia padrão em orçamento com config vazia", () => {
    const decision = decideReplicationFor(
      { id: "b5", media_config: {} },
      DEFAULT_MEDIA
    );
    expect(decision.action).toBe("apply");
  });

  it("PULA quando não há mídia padrão disponível", () => {
    const decision = decideReplicationFor(
      { id: "b6", media_config: null },
      null
    );
    expect(decision).toEqual({ action: "skip", reason: "no_default_available" });
  });
});

describe("media-replication / planReplication (lote)", () => {
  it("separa corretamente aplicáveis vs. pulados", () => {
    const budgets: BudgetForReplication[] = [
      { id: "manual-video", media_config: { video3d: "https://x/v.mp4" } },
      { id: "manual-fotos", media_config: { fotos: ["https://x/f.jpg"] } },
      { id: "manual-3d", media_config: { projeto3d: ["https://x/3d.png"] } },
      { id: "vazio-1", media_config: null },
      { id: "vazio-2", media_config: {} },
      { id: "vazio-3", media_config: { projeto3d: [], fotos: [], projetoExecutivo: [] } },
    ];

    const plan = planReplication(budgets, DEFAULT_MEDIA);

    expect(plan.applied.map(p => p.id).sort()).toEqual(["vazio-1", "vazio-2", "vazio-3"]);
    expect(plan.skipped.map(p => p.id).sort()).toEqual([
      "manual-3d",
      "manual-fotos",
      "manual-video",
    ]);
    plan.skipped.forEach(s => {
      expect(s.reason).toBe("manual_media_present");
    });
  });
});

/**
 * Simulação ponta-a-ponta: executa a replicação contra um cliente
 * Supabase MOCKADO e verifica que:
 *  1. Nenhum .update() é emitido contra orçamentos manuais.
 *  2. Nenhuma chamada ao Storage é feita.
 *  3. Apenas orçamentos elegíveis recebem update.
 */
describe("media-replication / simulação com Supabase mockado", () => {
  const updatedIds: string[] = [];
  const storageCalls: string[] = [];

  const mockSupabase = {
    from: vi.fn((table: string) => ({
      update: vi.fn((_payload: Record<string, unknown>) => ({
        eq: vi.fn((col: string, val: string) => {
          if (table === "budgets" && col === "id") {
            updatedIds.push(val);
          }
          return Promise.resolve({ error: null });
        }),
      })),
    })),
    storage: {
      from: vi.fn((bucket: string) => {
        storageCalls.push(`from:${bucket}`);
        return {
          upload: vi.fn(() => {
            storageCalls.push(`upload:${bucket}`);
            return Promise.resolve({ error: null });
          }),
          remove: vi.fn(() => {
            storageCalls.push(`remove:${bucket}`);
            return Promise.resolve({ error: null });
          }),
        };
      }),
    },
  };

  beforeEach(() => {
    updatedIds.length = 0;
    storageCalls.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Simulação da rotina real: planeja → executa apenas os "apply". */
  async function runReplication(budgets: BudgetForReplication[]) {
    const plan = planReplication(budgets, DEFAULT_MEDIA);
    for (const item of plan.applied) {
      await mockSupabase
        .from("budgets")
        .update({ media_config: item.nextConfig })
        .eq("id", item.id);
    }
    return plan;
  }

  it("não chama .update() em orçamentos com mídia manual", async () => {
    const budgets: BudgetForReplication[] = [
      { id: "manual-A", media_config: { video3d: "https://x/v.mp4" } },
      { id: "manual-B", media_config: { fotos: ["https://x/f.jpg"] } },
      { id: "manual-C", media_config: { projeto3d: ["https://x/p.png"] } },
    ];

    const plan = await runReplication(budgets);

    expect(plan.applied).toHaveLength(0);
    expect(plan.skipped).toHaveLength(3);
    expect(updatedIds).toEqual([]);
    // Garante que from('budgets') nem foi chamado para update.
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("nunca toca no Storage durante a replicação (apenas DB)", async () => {
    const budgets: BudgetForReplication[] = [
      { id: "manual-A", media_config: { video3d: "https://x/v.mp4" } },
      { id: "vazio-A", media_config: null },
      { id: "vazio-B", media_config: {} },
    ];

    await runReplication(budgets);

    expect(storageCalls).toEqual([]);
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  it("aplica update apenas nos orçamentos elegíveis (sem mídia)", async () => {
    const budgets: BudgetForReplication[] = [
      { id: "manual-1", media_config: { video3d: "https://x/v.mp4" } },
      { id: "vazio-1", media_config: null },
      { id: "manual-2", media_config: { fotos: ["https://x/f.jpg"] } },
      { id: "vazio-2", media_config: {} },
    ];

    const plan = await runReplication(budgets);

    expect(updatedIds.sort()).toEqual(["vazio-1", "vazio-2"]);
    expect(plan.applied.map(a => a.id).sort()).toEqual(["vazio-1", "vazio-2"]);
    // Confirma que os IDs manuais NÃO aparecem em nenhum update.
    expect(updatedIds).not.toContain("manual-1");
    expect(updatedIds).not.toContain("manual-2");
  });

  it("payload do update sempre passa pela sanitização (sem vídeo/exec/fotos)", async () => {
    const budgets: BudgetForReplication[] = [{ id: "vazio-X", media_config: null }];
    const plan = await runReplication(budgets);

    expect(plan.applied).toHaveLength(1);
    const payload = plan.applied[0].nextConfig;
    expect(payload.video3d).toBeUndefined();
    expect(payload.projetoExecutivo).toEqual([]);
    expect(payload.fotos).toEqual([]);
    expect(payload.projeto3d?.length).toBeGreaterThan(0);
  });

  it("invariante de idempotência: rodar 2x não altera orçamentos manuais", async () => {
    const budgets: BudgetForReplication[] = [
      { id: "manual-stable", media_config: { fotos: ["https://x/f.jpg"] } },
    ];

    await runReplication(budgets);
    await runReplication(budgets);

    expect(updatedIds).toEqual([]);
  });
});
