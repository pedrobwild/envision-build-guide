import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client with controllable storage + budgets responses
const storageState = new Map<string, { name: string }[]>();
const budgetsState = new Map<string, { media_config: unknown }>();
let lastUpdate: { id: string; media_config: unknown } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async (folder: string) => ({
          data: storageState.get(folder) ?? [],
          error: null,
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.test/${path}` },
        }),
      }),
    },
    from: (table: string) => {
      if (table !== "budgets") throw new Error("unexpected table");
      return {
        select: () => ({
          eq: (_c: string, id: string) => ({
            maybeSingle: async () => ({ data: budgetsState.get(id) ?? null, error: null }),
          }),
        }),
        update: (patch: { media_config: unknown }) => ({
          eq: async (_c: string, id: string) => {
            lastUpdate = { id, media_config: patch.media_config };
            const prev = budgetsState.get(id) ?? { media_config: null };
            budgetsState.set(id, { ...prev, media_config: patch.media_config });
            return { error: null };
          },
        }),
      };
    },
  },
}));

import { syncMediaConfigFromStorage } from "../budget-media-sync";

beforeEach(() => {
  storageState.clear();
  budgetsState.clear();
  lastUpdate = null;
});

describe("syncMediaConfigFromStorage", () => {
  it("Caso 1: Storage vazio → preserva media_config (herança do catálogo)", async () => {
    budgetsState.set("b1", {
      media_config: { projeto3d: ["https://template/lek/01.jpg", "https://template/lek/02.jpg"] },
    });
    const res = await syncMediaConfigFromStorage("b1", "pid-empty");
    expect(res.synced).toBe(false);
    expect(res.reason).toBe("storage_empty_preserve_inheritance");
    expect(lastUpdate).toBeNull();
    expect(budgetsState.get("b1")?.media_config).toEqual({
      projeto3d: ["https://template/lek/01.jpg", "https://template/lek/02.jpg"],
    });
  });

  it("Caso 2: Storage com fotos manuais → substitui media_config", async () => {
    budgetsState.set("b2", { media_config: { projeto3d: ["https://template/lek/old.jpg"] } });
    storageState.set("pid-custom/fotos", [{ name: "01-foto-cliente.jpg" }, { name: "02-detalhe.jpg" }]);
    storageState.set("pid-custom/3d", []);
    storageState.set("pid-custom/exec", []);
    storageState.set("pid-custom/video", []);

    const res = await syncMediaConfigFromStorage("b2", "pid-custom");
    expect(res.synced).toBe(true);
    expect(res.reason).toBe("storage_has_files");
    expect(res.counts.fotos).toBe(2);
    const mc = budgetsState.get("b2")?.media_config as { fotos: string[]; projeto3d: string[] };
    expect(mc.fotos).toEqual([
      "https://cdn.test/pid-custom/fotos/01-foto-cliente.jpg",
      "https://cdn.test/pid-custom/fotos/02-detalhe.jpg",
    ]);
    // template antigo NÃO sobrevive em projeto3d (Storage substitui)
    expect(mc.projeto3d).toEqual([]);
  });

  it("ignora arquivos ocultos / placeholders", async () => {
    budgetsState.set("b3", { media_config: null });
    storageState.set("pid-x/fotos", [
      { name: ".emptyFolderPlaceholder" },
      { name: ".lovkeep" },
      { name: "01-real.jpg" },
    ]);
    const res = await syncMediaConfigFromStorage("b3", "pid-x");
    expect(res.synced).toBe(true);
    expect((res as { counts: { fotos: number } }).counts.fotos).toBe(1);
  });

  it("sem publicId → não faz nada", async () => {
    const res = await syncMediaConfigFromStorage("b4", null);
    expect(res.synced).toBe(false);
    expect(res.reason).toBe("no_public_id");
    expect(lastUpdate).toBeNull();
  });
});
