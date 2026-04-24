import { describe, it, expect, vi } from "vitest";
import {
  collectMediaUrls,
  validateBudgetMedia,
  checkMediaUrl,
} from "./budget-media-validator";

const sampleMedia = {
  video3d: "https://cdn.example.com/v/intro.mp4",
  projeto3d: [
    "https://cdn.example.com/3d/cover.jpg",
    "https://cdn.example.com/3d/sala.jpg",
    "https://cdn.example.com/3d/cozinha.jpg",
  ],
  projetoExecutivo: ["https://cdn.example.com/exec/planta.jpg"],
  fotos: [
    "https://cdn.example.com/fotos/cover.jpg",
    "https://cdn.example.com/fotos/banheiro.jpg",
  ],
};

function fakeFetch(rules: Record<string, { ok: boolean; status?: number; throws?: boolean }>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const rule = rules[url];
    if (!rule) {
      return new Response(null, { status: 200 });
    }
    if (rule.throws) {
      throw new Error("network failure");
    }
    void init;
    return new Response(null, { status: rule.status ?? (rule.ok ? 200 : 404) });
  });
}

describe("collectMediaUrls", () => {
  it("retorna lista vazia para media nulo", () => {
    expect(collectMediaUrls(null)).toEqual([]);
    expect(collectMediaUrls(undefined)).toEqual([]);
    expect(collectMediaUrls({})).toEqual([]);
  });

  it("classifica primeira imagem como cover e demais como thumb", () => {
    const items = collectMediaUrls(sampleMedia);
    const fotos = items.filter((i) => i.category === "fotos");
    expect(fotos[0].role).toBe("cover");
    expect(fotos[1].role).toBe("thumb");
  });

  it("inclui video3d como role 'video'", () => {
    const items = collectMediaUrls(sampleMedia);
    const video = items.find((i) => i.category === "video3d");
    expect(video?.role).toBe("video");
  });

  it("conta total esperado de URLs", () => {
    expect(collectMediaUrls(sampleMedia)).toHaveLength(7);
  });
});

describe("checkMediaUrl", () => {
  it("considera ok quando HEAD retorna 2xx", async () => {
    const fetchImpl = fakeFetch({ "https://x/a.jpg": { ok: true } });
    const r = await checkMediaUrl("https://x/a.jpg", { fetchImpl });
    expect(r.ok).toBe(true);
  });

  it("faz fallback para GET parcial quando HEAD retorna 405", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "HEAD") return new Response(null, { status: 405 });
      return new Response(null, { status: 206 });
    });
    const r = await checkMediaUrl("https://x/a.jpg", { fetchImpl });
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retorna ok=false quando HEAD retorna 404", async () => {
    const fetchImpl = fakeFetch({ "https://x/missing.jpg": { ok: false, status: 404 } });
    const r = await checkMediaUrl("https://x/missing.jpg", { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it("captura erros de rede", async () => {
    const fetchImpl = fakeFetch({ "https://x/boom.jpg": { ok: false, throws: true } });
    const r = await checkMediaUrl("https://x/boom.jpg", { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("network failure");
  });
});

describe("validateBudgetMedia", () => {
  it("relata falhas separadas por categoria", async () => {
    const fetchImpl = fakeFetch({
      "https://cdn.example.com/v/intro.mp4": { ok: false, status: 404 },
      "https://cdn.example.com/3d/cover.jpg": { ok: true },
      "https://cdn.example.com/3d/sala.jpg": { ok: true },
      "https://cdn.example.com/3d/cozinha.jpg": { ok: false, status: 404 },
      "https://cdn.example.com/exec/planta.jpg": { ok: true },
      "https://cdn.example.com/fotos/cover.jpg": { ok: true },
      "https://cdn.example.com/fotos/banheiro.jpg": { ok: false, throws: true },
    });

    const report = await validateBudgetMedia(sampleMedia, { fetchImpl, concurrency: 3 });
    expect(report.totalChecked).toBe(7);
    expect(report.totalFailed).toBe(3);
    expect(report.byCategory.video3d.failed).toBe(1);
    expect(report.byCategory.projeto3d.failed).toBe(1);
    expect(report.byCategory.fotos.failed).toBe(1);
    expect(report.byCategory.projetoExecutivo.failed).toBe(0);

    const failedUrls = report.failures.map((f) => f.url).sort();
    expect(failedUrls).toEqual([
      "https://cdn.example.com/3d/cozinha.jpg",
      "https://cdn.example.com/fotos/banheiro.jpg",
      "https://cdn.example.com/v/intro.mp4",
    ]);
  });

  it("retorna relatório vazio para media sem URLs", async () => {
    const fetchImpl = fakeFetch({});
    const report = await validateBudgetMedia({}, { fetchImpl });
    expect(report.totalChecked).toBe(0);
    expect(report.totalFailed).toBe(0);
    expect(report.failures).toEqual([]);
  });

  it("preserva role (cover/thumb) na falha para diagnóstico", async () => {
    const fetchImpl = fakeFetch({
      "https://cdn.example.com/3d/cover.jpg": { ok: false, status: 404 },
      "https://cdn.example.com/3d/sala.jpg": { ok: true },
      "https://cdn.example.com/3d/cozinha.jpg": { ok: true },
    });
    const report = await validateBudgetMedia(
      { projeto3d: sampleMedia.projeto3d, fotos: [], projetoExecutivo: [] },
      { fetchImpl }
    );
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].role).toBe("cover");
  });
});
