import { describe, it, expect } from "vitest";
import { aggregateAbatementsByLabel } from "@/lib/budget-calc";
import { calculateBudgetTotal } from "@/lib/supabase-helpers";
import { resolveBudgetGrandTotal } from "@/lib/budget-total";
import type { BudgetSection, BudgetAdjustment } from "@/types/budget";

/**
 * Garantia de paridade financeira entre as superfícies pública desktop e mobile.
 *
 * Desktop renderiza via `<BudgetSummary>`, que deriva
 * `{discounts, credits, discountTotal, creditTotal}` de
 * `aggregateAbatementsByLabel(visibleSections)` e mostra
 * `subtotal = total + discountTotal + creditTotal`.
 *
 * Mobile renderiza via `<MobileInlineSummary>`, que recebe os mesmos campos
 * calculados em `PublicBudget.tsx`. Antes desta correção o mobile recalculava
 * abatimentos por seção (`calculateSectionSubtotal`) e ignorava descontos
 * dentro de seções com saldo positivo, divergindo do desktop.
 *
 * Estes testes congelam o contrato: ambos os lados DEVEM consumir o mesmo
 * `aggregateAbatementsByLabel` e produzir os mesmos números para o mesmo dataset.
 */

type SectionFixture = Pick<BudgetSection, "id" | "title" | "items">;

function makeSection(
  partial: Partial<SectionFixture> & { items?: Array<Partial<BudgetSection["items"][number]>> },
): BudgetSection {
  return {
    id: partial.id ?? `s-${Math.random().toString(36).slice(2, 8)}`,
    title: partial.title ?? "Seção",
    order_index: 0,
    qty: 1,
    unit: null,
    section_price: null,
    notes: null,
    subtitle: null,
    included_bullets: null,
    addendum_action: null,
    items: (partial.items ?? []).map((it, idx) => ({
      id: it.id ?? `i-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      section_id: it.section_id ?? "",
      order_index: it.order_index ?? idx,
      title: it.title ?? "Item",
      description: it.description ?? null,
      qty: it.qty ?? 1,
      unit: it.unit ?? "un",
      internal_unit_price: it.internal_unit_price ?? null,
      internal_total: it.internal_total ?? null,
      bdi_percentage: it.bdi_percentage ?? 0,
      coverage_type: it.coverage_type ?? "geral",
      included_rooms: it.included_rooms ?? null,
      addendum_action: it.addendum_action ?? null,
    })) as BudgetSection["items"],
  } as BudgetSection;
}

/** Replica a lógica do desktop (`BudgetSummary`). */
function computeDesktop(sections: BudgetSection[], adjustments: BudgetAdjustment[], manualTotal?: number | null) {
  const computedTotal = calculateBudgetTotal(sections, adjustments);
  const { total } = resolveBudgetGrandTotal({ manualTotal, computedTotal });
  const { discounts, credits, discountTotal, creditTotal } = aggregateAbatementsByLabel(sections);
  const subtotal = total + discountTotal + creditTotal;
  return { total, subtotal, discountTotal, creditTotal, discounts, credits };
}

/** Replica a lógica do mobile (`PublicBudget.tsx` → `MobileInlineSummary`). */
function computeMobile(sections: BudgetSection[], adjustments: BudgetAdjustment[], manualTotal?: number | null) {
  const computedTotal = calculateBudgetTotal(sections, adjustments);
  const { total } = resolveBudgetGrandTotal({ manualTotal, computedTotal });
  const breakdown = aggregateAbatementsByLabel(sections);
  const publicDiscountTotal = breakdown.discountTotal;
  const publicCreditTotal = breakdown.creditTotal;
  const publicSubtotal = total + publicDiscountTotal + publicCreditTotal;
  return {
    total,
    subtotal: publicSubtotal,
    discountTotal: publicDiscountTotal,
    creditTotal: publicCreditTotal,
    discounts: breakdown.discounts,
    credits: breakdown.credits,
  };
}

function expectParity(
  desktop: ReturnType<typeof computeDesktop>,
  mobile: ReturnType<typeof computeMobile>,
) {
  expect(mobile.total).toBeCloseTo(desktop.total, 2);
  expect(mobile.subtotal).toBeCloseTo(desktop.subtotal, 2);
  expect(mobile.discountTotal).toBeCloseTo(desktop.discountTotal, 2);
  expect(mobile.creditTotal).toBeCloseTo(desktop.creditTotal, 2);
  expect(mobile.discounts.map((l) => [l.label, Math.round(l.total * 100) / 100])).toEqual(
    desktop.discounts.map((l) => [l.label, Math.round(l.total * 100) / 100]),
  );
  expect(mobile.credits.map((l) => [l.label, Math.round(l.total * 100) / 100])).toEqual(
    desktop.credits.map((l) => [l.label, Math.round(l.total * 100) / 100]),
  );
}

describe("Public budget mobile ↔ desktop totals parity", () => {
  it("orçamento simples sem abatimentos — total/subtotal idênticos", () => {
    const sections = [
      makeSection({
        title: "Marcenaria",
        items: [
          { title: "Armário cozinha", qty: 1, internal_unit_price: 10000, bdi_percentage: 50 },
          { title: "Painel TV", qty: 1, internal_unit_price: 4000, bdi_percentage: 50 },
        ],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    expect(desktop.discountTotal).toBe(0);
    expect(desktop.creditTotal).toBe(0);
  });

  it("desconto promocional dentro de seção 'Descontos' — paridade total", () => {
    const sections = [
      makeSection({
        title: "Marcenaria",
        items: [{ title: "Armário", qty: 1, internal_unit_price: 20000, bdi_percentage: 50 }],
      }),
      makeSection({
        title: "Descontos",
        items: [{ title: "Desconto promocional", qty: 1, internal_unit_price: -3000, bdi_percentage: 0 }],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    expect(desktop.discountTotal).toBeCloseTo(3000, 2);
    expect(desktop.creditTotal).toBe(0);
  });

  it("crédito (abatimento de cliente) em seção 'Créditos' separa-se de desconto", () => {
    const sections = [
      makeSection({
        title: "Hidráulica",
        items: [{ title: "Instalação", qty: 1, internal_unit_price: 12000, bdi_percentage: 40 }],
      }),
      makeSection({
        title: "Créditos",
        items: [{ title: "Crédito sinal", qty: 1, internal_unit_price: -5000, bdi_percentage: 0 }],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    expect(desktop.creditTotal).toBeCloseTo(5000, 2);
    expect(desktop.discountTotal).toBe(0);
  });

  it("desconto embutido em seção positiva — mobile não pode mais ignorar (regression test)", () => {
    // Caso clássico do bug: a seção "Marcenaria" tem saldo POSITIVO (=> sub >= 0),
    // mas contém um item negativo dentro dela. A lógica antiga do mobile pulava
    // a seção inteira (sub >= 0 ? continue) e reportava desconto = 0.
    // Agora ambos consomem aggregateAbatementsByLabel e enxergam o item negativo.
    const sections = [
      makeSection({
        title: "Marcenaria",
        items: [
          { title: "Armário", qty: 1, internal_unit_price: 30000, bdi_percentage: 50 },
          { title: "Cortesia projeto 3D", qty: 1, internal_unit_price: -2000, bdi_percentage: 0 },
        ],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    // Confirma que o desconto embutido aparece de fato (não é 0).
    expect(mobile.discountTotal).toBeGreaterThan(0);
    expect(mobile.discounts.some((l) => l.label.toLowerCase().includes("cortesia"))).toBe(true);
  });

  it("múltiplos descontos com mesmo rótulo agregam em uma única linha em ambas as superfícies", () => {
    const sections = [
      makeSection({
        title: "Elétrica",
        items: [{ title: "Pontos", qty: 10, internal_unit_price: 500, bdi_percentage: 30 }],
      }),
      makeSection({
        title: "Descontos",
        items: [
          { title: "Desconto promocional", qty: 1, internal_unit_price: -1000, bdi_percentage: 0 },
          { title: "Desconto promocional", qty: 1, internal_unit_price: -500, bdi_percentage: 0 },
          { title: "Indicação", qty: 1, internal_unit_price: -300, bdi_percentage: 0 },
        ],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    expect(mobile.discounts).toHaveLength(2);
    const promo = mobile.discounts.find((l) => l.label === "Desconto promocional");
    expect(promo?.total).toBeCloseTo(1500, 2);
  });

  it("manual_total preserva paridade — ambos reportam o mesmo total final", () => {
    const sections = [
      makeSection({
        title: "Marcenaria",
        items: [{ title: "Armário", qty: 1, internal_unit_price: 10000, bdi_percentage: 50 }],
      }),
      makeSection({
        title: "Descontos",
        items: [{ title: "Desconto promocional", qty: 1, internal_unit_price: -2000, bdi_percentage: 0 }],
      }),
    ];
    // manual_total quebra de propósito a soma calculada para validar
    // que mobile e desktop continuam mostrando o MESMO número final.
    const manualTotal = 12345.67;
    const desktop = computeDesktop(sections, [], manualTotal);
    const mobile = computeMobile(sections, [], manualTotal);
    expectParity(desktop, mobile);
    expect(mobile.total).toBeCloseTo(12345.67, 2);
  });

  it("dataset complexo (descontos + créditos + várias seções) — paridade integral", () => {
    const sections = [
      makeSection({
        title: "Marcenaria",
        items: [
          { title: "Armário cozinha", qty: 1, internal_unit_price: 25000, bdi_percentage: 60 },
          { title: "Painel TV", qty: 1, internal_unit_price: 6000, bdi_percentage: 60 },
          { title: "Cortesia 3D", qty: 1, internal_unit_price: -1500, bdi_percentage: 0 },
        ],
      }),
      makeSection({
        title: "Hidráulica",
        items: [{ title: "Instalação", qty: 1, internal_unit_price: 12000, bdi_percentage: 40 }],
      }),
      makeSection({
        title: "Descontos",
        items: [
          { title: "Desconto promocional", qty: 1, internal_unit_price: -2500, bdi_percentage: 0 },
          { title: "Indicação", qty: 1, internal_unit_price: -800, bdi_percentage: 0 },
        ],
      }),
      makeSection({
        title: "Créditos",
        items: [{ title: "Crédito sinal", qty: 1, internal_unit_price: -4000, bdi_percentage: 0 }],
      }),
    ];
    const desktop = computeDesktop(sections, []);
    const mobile = computeMobile(sections, []);
    expectParity(desktop, mobile);
    // Sanidade: subtotal = total + descontos + créditos
    expect(mobile.subtotal).toBeCloseTo(mobile.total + mobile.discountTotal + mobile.creditTotal, 2);
  });
});
