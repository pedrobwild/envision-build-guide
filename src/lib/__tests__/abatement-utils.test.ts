import { describe, it, expect } from "vitest";
import { isAbatementSection, isCreditSection, normalizeAbatementValue } from "../abatement-utils";

describe("abatement-utils", () => {
  describe("isAbatementSection", () => {
    it("identifica Descontos / Créditos (case + acento)", () => {
      expect(isAbatementSection("Descontos")).toBe(true);
      expect(isAbatementSection("descontos")).toBe(true);
      expect(isAbatementSection("Créditos")).toBe(true);
      expect(isAbatementSection("creditos")).toBe(true);
      expect(isAbatementSection("  Créditos  ")).toBe(true);
    });

    it("retorna false para seções normais", () => {
      expect(isAbatementSection("Materiais")).toBe(false);
      expect(isAbatementSection("")).toBe(false);
      expect(isAbatementSection(null)).toBe(false);
      expect(isAbatementSection(undefined)).toBe(false);
    });
  });

  describe("isCreditSection", () => {
    it("diferencia crédito de desconto", () => {
      expect(isCreditSection("Créditos")).toBe(true);
      expect(isCreditSection("creditos")).toBe(true);
      expect(isCreditSection("Descontos")).toBe(false);
    });
  });

  describe("normalizeAbatementValue", () => {
    it("converte positivo em negativo dentro de seção de abatimento", () => {
      expect(normalizeAbatementValue(3000, "Créditos")).toBe(-3000);
      expect(normalizeAbatementValue(1500.5, "Descontos")).toBe(-1500.5);
    });

    it("preserva valores já negativos", () => {
      expect(normalizeAbatementValue(-3000, "Créditos")).toBe(-3000);
      expect(normalizeAbatementValue(-500, "Descontos")).toBe(-500);
    });

    it("preserva 0 e null", () => {
      expect(normalizeAbatementValue(0, "Créditos")).toBe(0);
      expect(normalizeAbatementValue(null, "Créditos")).toBe(null);
      expect(normalizeAbatementValue(undefined, "Descontos")).toBe(null);
    });

    it("não altera seções normais", () => {
      expect(normalizeAbatementValue(3000, "Materiais")).toBe(3000);
      expect(normalizeAbatementValue(-500, "Mão de obra")).toBe(-500);
      expect(normalizeAbatementValue(1000, undefined)).toBe(1000);
    });

    it("rejeita NaN/Infinity retornando null", () => {
      expect(normalizeAbatementValue(NaN, "Créditos")).toBe(null);
      expect(normalizeAbatementValue(Infinity, "Descontos")).toBe(null);
    });
  });
});
