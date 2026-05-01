import { describe, it, expect } from "vitest";
import {
  computePublicAbatements,
  assertPublicAbatementParity,
} from "@/lib/public-abatements";
import { fxOrçamentoCompletoMisto } from "./fixtures/mixed-section-budgets";

describe("public-abatements parity guard", () => {
  it("computePublicAbatements retorna marca __source válida", () => {
    const sections = fxOrçamentoCompletoMisto();
    const result = computePublicAbatements(sections);
    expect(result.__source).toBe("aggregateAbatementsByLabel");
  });

  it("assertPublicAbatementParity passa para resultado legítimo", () => {
    const sections = fxOrçamentoCompletoMisto();
    const result = computePublicAbatements(sections);
    expect(() => assertPublicAbatementParity(sections, result, "mobile")).not.toThrow();
    expect(() => assertPublicAbatementParity(sections, result, "desktop")).not.toThrow();
  });

  it("falha se a marca __source for adulterada (recálculo manual disfarçado)", () => {
    const sections = fxOrçamentoCompletoMisto();
    const tampered = {
      ...computePublicAbatements(sections),
      __source: "manual" as unknown as "aggregateAbatementsByLabel",
    };
    expect(() => assertPublicAbatementParity(sections, tampered, "mobile")).toThrow(
      /recalculo manual detectado/i,
    );
  });

  it("falha se os totais forem mutados após o cálculo", () => {
    const sections = fxOrçamentoCompletoMisto();
    const result = computePublicAbatements(sections);
    const tampered = { ...result, discountTotal: result.discountTotal + 999 };
    expect(() => assertPublicAbatementParity(sections, tampered, "mobile")).toThrow(
      /divergência detectada/i,
    );
  });

  it("falha se as linhas forem reordenadas ou alteradas", () => {
    const sections = fxOrçamentoCompletoMisto();
    const result = computePublicAbatements(sections);
    const tampered = {
      ...result,
      discounts: [{ label: "Inventado", total: 1 }, ...result.discounts],
    };
    expect(() => assertPublicAbatementParity(sections, tampered, "desktop")).toThrow(
      /divergência detectada/i,
    );
  });
});
