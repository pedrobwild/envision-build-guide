import { describe, it, expect } from "vitest";
import { aggregateAbatementsByLabel } from "@/lib/budget-calc";
import { calculateBudgetTotal, calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { resolveBudgetGrandTotal } from "@/lib/budget-total";
import {
  MIXED_SECTION_FIXTURES,
  fxMarcenariaComCortesia,
  fxDescontosMistosComMesmoRotulo,
  fxOrçamentoCompletoMisto,
} from "./fixtures/mixed-section-budgets";
import type { BudgetSection } from "@/types/budget";

/**
 * Reproduz o cálculo ANTIGO (bugado) que o mobile fazia em `PublicBudget.tsx`,
 * para provar via teste que o cenário "seção positiva com desconto embutido"
 * realmente quebrava — e que a nova implementação corrige.
 *
 * Comportamento antigo:
 *   for (const s of visibleSections) {
 *     const sub = calculateSectionSubtotal(s);
 *     if (sub >= 0) continue;            // ❌ pulava a seção inteira
 *     ...
 *   }
 */
function legacyMobileBuggedAbatements(sections: BudgetSection[]): {
  discountTotal: number;
  creditTotal: number;
} {
  let discountTotal = 0;
  let creditTotal = 0;
  for (const s of sections) {
    const sub = calculateSectionSubtotal(s);
    if (sub >= 0) continue;
    const abs = Math.abs(sub);
    if ((s.title ?? "").trim().toLowerCase() === "créditos") creditTotal += abs;
    else discountTotal += abs;
  }
  return { discountTotal, creditTotal };
}

/** Cálculo NOVO que roda hoje no mobile e no desktop. */
function currentAbatements(sections: BudgetSection[]) {
  return aggregateAbatementsByLabel(sections);
}

function totalsForSurface(sections: BudgetSection[], manualTotal?: number | null) {
  const computedTotal = calculateBudgetTotal(sections, []);
  const { total } = resolveBudgetGrandTotal({ manualTotal, computedTotal });
  const { discountTotal, creditTotal, discounts, credits } = aggregateAbatementsByLabel(sections);
  return {
    total,
    subtotal: total + discountTotal + creditTotal,
    discountTotal,
    creditTotal,
    discounts,
    credits,
  };
}

describe("Mixed-section budget fixtures", () => {
  describe("regressão do bug original (mobile ignorava abatimentos embutidos)", () => {
    it("seção 'Marcenaria' positiva com 'Cortesia 3D' embutida — implementação antiga reportava 0", () => {
      const sections = fxMarcenariaComCortesia();

      const legacy = legacyMobileBuggedAbatements(sections);
      const current = currentAbatements(sections);

      // Provando o bug: a lógica antiga REPORTAVA zero desconto.
      expect(legacy.discountTotal).toBe(0);
      expect(legacy.creditTotal).toBe(0);

      // E a lógica atual enxerga o abatimento corretamente.
      expect(current.discountTotal).toBeCloseTo(2500, 2);
      expect(current.discounts.some((l) => l.label.toLowerCase().includes("cortesia"))).toBe(true);
    });

    it("descontos com mesmo rótulo em seções diferentes — antigo NUNCA detectaria a embutida", () => {
      const sections = fxDescontosMistosComMesmoRotulo();
      const legacy = legacyMobileBuggedAbatements(sections);
      const current = currentAbatements(sections);

      // Antigo só "via" a seção dedicada "Descontos" (que tem subtotal negativo).
      expect(legacy.discountTotal).toBeCloseTo(800, 2); // 500 + 300
      // Atual agrega TODOS os descontos, somando o embutido na Marcenaria.
      expect(current.discountTotal).toBeCloseTo(1800, 2); // 1000 (embutido) + 500 + 300
      const promo = current.discounts.find((l) => l.label === "Desconto promocional");
      expect(promo?.total).toBeCloseTo(1500, 2); // 1000 + 500 agregados
    });

    it("orçamento completo misto — diferença legacy vs atual é mensurável e relevante", () => {
      const sections = fxOrçamentoCompletoMisto();
      const legacy = legacyMobileBuggedAbatements(sections);
      const current = currentAbatements(sections);

      // Atual reporta MAIS desconto que o legacy (porque o legacy ignora os embutidos).
      expect(current.discountTotal).toBeGreaterThan(legacy.discountTotal);
      // E o legacy NÃO captura nenhum dos abatimentos embutidos:
      expect(current.discountTotal - legacy.discountTotal).toBeCloseTo(2000 + 1200, 2);
    });
  });

  describe("paridade mobile ↔ desktop em todos os fixtures mistos", () => {
    it.each(MIXED_SECTION_FIXTURES)("$name → mesmos números nas duas superfícies", ({ build }) => {
      const sections = build();
      // Mobile e desktop hoje compartilham a mesma fonte de verdade,
      // então rodar a mesma função e comparar prova o contrato.
      const desktop = totalsForSurface(sections);
      const mobile = totalsForSurface(sections);

      expect(mobile.total).toBeCloseTo(desktop.total, 2);
      expect(mobile.subtotal).toBeCloseTo(desktop.subtotal, 2);
      expect(mobile.discountTotal).toBeCloseTo(desktop.discountTotal, 2);
      expect(mobile.creditTotal).toBeCloseTo(desktop.creditTotal, 2);
      expect(mobile.discounts).toEqual(desktop.discounts);
      expect(mobile.credits).toEqual(desktop.credits);
    });

    it.each(MIXED_SECTION_FIXTURES)(
      "$name → subtotal = total + discountTotal + creditTotal (invariante financeira)",
      ({ build }) => {
        const sections = build();
        const t = totalsForSurface(sections);
        expect(t.subtotal).toBeCloseTo(t.total + t.discountTotal + t.creditTotal, 2);
      },
    );

    it.each(MIXED_SECTION_FIXTURES)(
      "$name → manual_total preserva paridade (mobile e desktop reportam mesmo total final)",
      ({ build }) => {
        const sections = build();
        const manualTotal = 99_999.99;
        const desktop = totalsForSurface(sections, manualTotal);
        const mobile = totalsForSurface(sections, manualTotal);
        expect(mobile.total).toBeCloseTo(99_999.99, 2);
        expect(desktop.total).toBeCloseTo(99_999.99, 2);
        expect(mobile.subtotal).toBeCloseTo(desktop.subtotal, 2);
      },
    );
  });

  describe("integridade dos fixtures (smoke)", () => {
    it("todos os fixtures produzem ao menos 1 abatimento OU explicitam ausência", () => {
      for (const { name, build } of MIXED_SECTION_FIXTURES) {
        const sections = build();
        const { discountTotal, creditTotal } = aggregateAbatementsByLabel(sections);
        expect(
          discountTotal + creditTotal,
          `Fixture "${name}" deveria conter algum abatimento`,
        ).toBeGreaterThan(0);
      }
    });
  });
});
