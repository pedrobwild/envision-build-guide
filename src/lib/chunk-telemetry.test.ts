/**
 * Testes da telemetria de chunk-load:
 *  - dedup por chave composta (public_id, route, deploy_version, chunk_url)
 *  - normalização de chunk_url (remove query string)
 *  - dedup por sessão (sessionStorage)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock do supabase client antes de importar o módulo testado.
const insertMock = vi.fn(async () => ({ error: null }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const getSessionMock = vi.fn(async () => ({ data: { session: null } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...(args as [])),
    auth: { getSession: () => getSessionMock() },
  },
}));

// Helper para resetar o estado do módulo entre testes.
async function loadModule() {
  vi.resetModules();
  return await import("./chunk-telemetry");
}

function setLocation(pathname: string, search = "") {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      pathname,
      search,
      origin: "https://app.test",
      href: `https://app.test${pathname}${search}`,
    },
  });
}

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
  getSessionMock.mockClear();
  sessionStorage.clear();
  setLocation("/o/abc123");
  // Garante navigator mínimo
  Object.defineProperty(window, "navigator", {
    configurable: true,
    value: {
      userAgent: "vitest",
      onLine: true,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chunk-telemetry: dedup e normalização", () => {
  it("envia apenas um insert para a mesma chave composta em chamadas sequenciais", async () => {
    const { reportChunkLoadError } = await loadModule();

    await reportChunkLoadError({
      errorName: "ChunkLoadError",
      errorMessage: "Failed to fetch dynamically imported module",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js",
    });
    await reportChunkLoadError({
      errorName: "ChunkLoadError",
      errorMessage: "Failed to fetch dynamically imported module",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js",
    });
    await reportChunkLoadError({
      errorName: "ChunkLoadError",
      errorMessage: "Failed to fetch dynamically imported module",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js",
    });

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("chunk_load_errors");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("normaliza chunk_url removendo query params (?v, ?retry, ?t)", async () => {
    const { reportChunkLoadError } = await loadModule();

    await reportChunkLoadError({
      errorName: "ChunkLoadError",
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js?v=123",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0] as { chunk_url: string };
    expect(payload.chunk_url).toBe("https://app.test/assets/PublicBudget-abc.js");
  });

  it("trata como mesma chave URLs do mesmo chunk com query params diferentes", async () => {
    const { reportChunkLoadError } = await loadModule();

    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js?v=1",
    });
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js?retry=2",
    });
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/PublicBudget-abc.js?t=999",
    });

    // Apenas o primeiro deve passar; os demais caem em dedup composto.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("envia eventos separados para public_ids diferentes (mesma rota base)", async () => {
    const { reportChunkLoadError } = await loadModule();

    setLocation("/o/aaa111");
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/X.js",
    });
    setLocation("/o/bbb222");
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/X.js",
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
    const first = insertMock.mock.calls[0][0] as { public_id: string };
    const second = insertMock.mock.calls[1][0] as { public_id: string };
    expect(first.public_id).toBe("aaa111");
    expect(second.public_id).toBe("bbb222");
  });

  it("envia eventos separados para chunks distintos no mesmo public_id", async () => {
    const { reportChunkLoadError } = await loadModule();

    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/A.js",
    });
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/B.js",
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("dedup persistente por sessão impede reenvio mesmo após expirar a janela em memória", async () => {
    vi.useFakeTimers();
    const { reportChunkLoadError } = await loadModule();

    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/A.js",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);

    // Avança além da janela de 60s — em memória não deduparia mais.
    vi.advanceTimersByTime(120_000);

    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/A.js",
    });

    // Mas o sessionStorage ainda contém a chave: nada de novo insert.
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("a chave de dedup ignora query string da rota (ex.: ?utm_source=...)", async () => {
    const { reportChunkLoadError } = await loadModule();

    setLocation("/o/abc123", "?utm_source=email");
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/A.js",
    });

    setLocation("/o/abc123", "?utm_source=whatsapp");
    await reportChunkLoadError({
      errorMessage: "Loading chunk failed",
      chunkUrl: "https://app.test/assets/A.js",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
