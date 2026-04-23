import { describe, it, expect } from "vitest";
import {
  sanitizeDefaultMedia,
  isValidDefaultMedia,
  getHardcodedFallbackMedia,
} from "./default-media-policy";

describe("default-media-policy", () => {
  describe("sanitizeDefaultMedia", () => {
    it("mantém somente projeto3d quando o template tem só 3D (caso Lek)", () => {
      const lekLike = {
        projeto3d: ["url-1.png", "url-2.png", "url-3.png"],
        projetoExecutivo: [],
        fotos: [],
      };
      const result = sanitizeDefaultMedia(lekLike);
      expect(result).toEqual({
        projeto3d: ["url-1.png", "url-2.png", "url-3.png"],
        projetoExecutivo: [],
        fotos: [],
      });
      expect(result?.video3d).toBeUndefined();
    });

    it("descarta video3d mesmo se template indevidamente o definir", () => {
      const tampered = {
        video3d: "https://exemplo.com/video.mp4",
        projeto3d: ["a.png"],
        projetoExecutivo: [],
        fotos: [],
      };
      const result = sanitizeDefaultMedia(tampered);
      expect(result?.video3d).toBeUndefined();
      expect(result?.projeto3d).toEqual(["a.png"]);
    });

    it("descarta projetoExecutivo e fotos mesmo se template os definir", () => {
      const tampered = {
        projeto3d: ["a.png"],
        projetoExecutivo: ["exec1.png", "exec2.png"],
        fotos: ["foto1.jpg"],
      };
      const result = sanitizeDefaultMedia(tampered);
      expect(result?.projetoExecutivo).toEqual([]);
      expect(result?.fotos).toEqual([]);
      expect(result?.projeto3d).toEqual(["a.png"]);
    });

    it("retorna null quando não há nenhuma imagem 3D válida", () => {
      expect(sanitizeDefaultMedia({ projeto3d: [] })).toBeNull();
      expect(sanitizeDefaultMedia({ video3d: "v.mp4", projetoExecutivo: ["x"], fotos: ["y"] })).toBeNull();
      expect(sanitizeDefaultMedia({})).toBeNull();
      expect(sanitizeDefaultMedia(null)).toBeNull();
      expect(sanitizeDefaultMedia(undefined)).toBeNull();
    });

    it("filtra entradas inválidas dentro do array projeto3d", () => {
      const dirty = {
        projeto3d: ["valid.png", "", "  ", "outro.png"] as string[],
      };
      const result = sanitizeDefaultMedia(dirty);
      expect(result?.projeto3d).toEqual(["valid.png", "outro.png"]);
    });
  });

  describe("isValidDefaultMedia", () => {
    it("aceita config com apenas projeto3d preenchido", () => {
      expect(isValidDefaultMedia({ projeto3d: ["a.png"] })).toBe(true);
    });

    it("rejeita config com video3d", () => {
      expect(isValidDefaultMedia({ projeto3d: ["a.png"], video3d: "x.mp4" })).toBe(false);
    });

    it("rejeita config com projetoExecutivo preenchido", () => {
      expect(isValidDefaultMedia({ projeto3d: ["a.png"], projetoExecutivo: ["e.png"] })).toBe(false);
    });

    it("rejeita config com fotos preenchidas", () => {
      expect(isValidDefaultMedia({ projeto3d: ["a.png"], fotos: ["f.jpg"] })).toBe(false);
    });

    it("rejeita config sem projeto3d", () => {
      expect(isValidDefaultMedia({ projeto3d: [] })).toBe(false);
      expect(isValidDefaultMedia({})).toBe(false);
      expect(isValidDefaultMedia(null)).toBe(false);
    });
  });

  describe("getHardcodedFallbackMedia (safety net)", () => {
    it("retorna sempre uma config válida com 15 imagens 3D", () => {
      const fallback = getHardcodedFallbackMedia();
      expect(fallback.projeto3d).toHaveLength(15);
      expect(fallback.projetoExecutivo).toEqual([]);
      expect(fallback.fotos).toEqual([]);
      expect(fallback.video3d).toBeUndefined();
    });

    it("respeita a política padrão (passa em isValidDefaultMedia)", () => {
      expect(isValidDefaultMedia(getHardcodedFallbackMedia())).toBe(true);
    });

    it("URLs apontam para o bucket público media com a pasta /3d/", () => {
      const fallback = getHardcodedFallbackMedia();
      fallback.projeto3d?.forEach((url) => {
        expect(url).toContain("/storage/v1/object/public/media/");
        expect(url).toContain("/3d/");
        expect(url).toMatch(/\.png$/);
      });
    });

    it("é estável entre chamadas (mesmo conjunto de URLs)", () => {
      const a = getHardcodedFallbackMedia();
      const b = getHardcodedFallbackMedia();
      expect(a.projeto3d).toEqual(b.projeto3d);
    });
  });
});
