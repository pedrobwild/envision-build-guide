/**
 * Garante que `computeBudgetXlsxTotals` (fonte dos números do export Excel)
 * bate 100% com `calcGrandTotals` / `calcSectionSaleTotal` — os mesmos
 * helpers usados pelo editor e pelo resumo público.
 *
 * Cenários cobertos:
 *   1. Itens com `internal_unit_price * qty` + BDI
 *   2. Itens lump-sum (`internal_total`) + BDI
 *   3. Mistura unit_price/lump-sum dentro da mesma seção
 *   4. Quantidade da seção (`sec.qty`) multiplicando o subtotal
 *   5. Seção de Créditos (NÃO afeta margem, mas abate `sale`)
 *   6. Itens negativos em seção "Descontos"
 *   7. Ajustes globais (positivos e negativos)
 */
import { describe, it, expect } from "vitest";
import {
  computeBudgetXlsxTotals,
  type BudgetXlsxSectionInput,
  type BudgetXlsxItemInput,
  type BudgetXlsxAdjustmentInput,
} from "@/lib/budget-xlsx-export";
import {
  calcGrandTotals,
  calcSectionCostTotal,
  calcSectionSaleTotal,
  isCreditSection,
  type CalcSection,
} from "@/lib/budget-calc";

/** Reconstrói as `CalcSection` a partir dos inputs do export, para que o
 *  teste compare contra `calcGrandTotals` da mesma forma que o código real. */
function toCalcSections(
  sections: BudgetXlsxSectionInput[],
  items: BudgetXlsxItemInput[],
): CalcSection[] {
  return sections.map((sec) => ({
    qty: sec.qty,
    section_price: sec.section_price,
    title: sec.title,
    items: items
      .filter((i) => i.section_id === sec.id)
      .map((it) => ({
        qty: it.qty,
        internal_unit_price: it.internal_unit_price,
        internal_total: it.internal_total,
        bdi_percentage: it.bdi_percentage,
        title: it.title,
      })),
  }));
}

describe("computeBudgetXlsxTotals — paridade com calcGrandTotals", () => {
  it("cenário 1: itens com unit_price * qty + BDI", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Pisos", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 10, internal_unit_price: 150, internal_total: null, bdi_percentage: 30 },
      { section_id: "s1", qty: 5, internal_unit_price: 80, internal_total: null, bdi_percentage: 30 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const grand = calcGrandTotals(toCalcSections(sections, items));

    // Custo: 10*150 + 5*80 = 1900
    expect(totals.cost).toBe(1900);
    // Venda: 1900 * 1.30 = 2470
    expect(totals.sale).toBeCloseTo(2470, 6);
    expect(totals.cost).toBe(grand.cost);
    expect(totals.saleMargin).toBe(grand.sale);
    expect(totals.marginRatio).toBeCloseTo(grand.marginPercent / 100, 6);
  });

  it("cenário 2: itens lump-sum (internal_total) + BDI", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Mão de obra", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: null, internal_unit_price: null, internal_total: 5000, bdi_percentage: 20 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const grand = calcGrandTotals(toCalcSections(sections, items));

    expect(totals.cost).toBe(5000);
    expect(totals.sale).toBeCloseTo(6000, 6);
    expect(totals.cost).toBe(grand.cost);
    expect(totals.saleMargin).toBe(grand.sale);
  });

  it("cenário 3: mistura unit_price + lump-sum na mesma seção", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Geral", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 4, internal_unit_price: 100, internal_total: null, bdi_percentage: 25 },
      { section_id: "s1", qty: null, internal_unit_price: null, internal_total: 1200, bdi_percentage: 25 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const calcSecs = toCalcSections(sections, items);
    const grand = calcGrandTotals(calcSecs);

    // Custo: 400 + 1200 = 1600 ; Venda: 500 + 1500 = 2000
    expect(totals.cost).toBe(1600);
    expect(totals.sale).toBeCloseTo(2000, 6);
    expect(totals.sale).toBeCloseTo(grand.sale, 6);
    // Subtotal por seção também deve bater
    expect(calcSectionCostTotal(calcSecs[0])).toBe(1600);
    expect(calcSectionSaleTotal(calcSecs[0])).toBeCloseTo(2000, 6);
  });

  it("cenário 4: quantidade da seção multiplica o subtotal", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Quartos", qty: 3, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 1, internal_unit_price: 200, internal_total: null, bdi_percentage: 50 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const calcSecs = toCalcSections(sections, items);

    // Custo: 200 * 3 (sec.qty) = 600 ; Venda: 300 * 3 = 900
    expect(totals.cost).toBe(600);
    expect(totals.sale).toBeCloseTo(900, 6);
    expect(calcSectionCostTotal(calcSecs[0])).toBe(600);
    expect(calcSectionSaleTotal(calcSecs[0])).toBeCloseTo(900, 6);
  });

  it("cenário 5: seção de Créditos abate sale mas NÃO entra na margem", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Reforma", qty: 1, section_price: null },
      { id: "s2", title: "Créditos", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      // Seção produtiva: custo 1000, venda 1300
      { section_id: "s1", qty: 1, internal_unit_price: 1000, internal_total: null, bdi_percentage: 30 },
      // Crédito: -500 (abate o total mostrado ao cliente)
      { section_id: "s2", qty: 1, internal_unit_price: -500, internal_total: null, bdi_percentage: 0, title: "Crédito de obra" },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const calcSecs = toCalcSections(sections, items);
    const grand = calcGrandTotals(calcSecs);

    // Margem é calculada SEM o crédito (calcGrandTotals filtra créditos)
    expect(totals.cost).toBe(grand.cost);
    expect(totals.cost).toBe(1000);
    expect(totals.saleMargin).toBe(grand.sale);
    expect(totals.saleMargin).toBeCloseTo(1300, 6);
    // Total mostrado ao cliente: 1300 - 500 = 800
    expect(totals.creditTotal).toBeCloseTo(-500, 6);
    expect(totals.sale).toBeCloseTo(800, 6);
    // Crédito identificado corretamente
    expect(isCreditSection(calcSecs[1])).toBe(true);
  });

  it("cenário 6: itens negativos em seção Descontos reduzem custo e venda na margem", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Reforma", qty: 1, section_price: null },
      { id: "s2", title: "Descontos", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 1, internal_unit_price: 2000, internal_total: null, bdi_percentage: 25 },
      // Desconto: contribui negativamente para AMBOS custo e venda
      { section_id: "s2", qty: 1, internal_unit_price: -300, internal_total: null, bdi_percentage: 0, title: "Desconto promocional" },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const grand = calcGrandTotals(toCalcSections(sections, items));

    // Descontos NÃO são créditos → entram na margem
    // Custo: 2000 - 300 = 1700 ; Venda: 2500 - 300 = 2200
    expect(totals.cost).toBe(1700);
    expect(totals.sale).toBeCloseTo(2200, 6);
    expect(totals.cost).toBe(grand.cost);
    expect(totals.saleMargin).toBeCloseTo(grand.sale, 6);
    expect(totals.creditTotal).toBe(0);
  });

  it("cenário 7: ajustes globais positivos e negativos", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Obra", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 1, internal_unit_price: 1000, internal_total: null, bdi_percentage: 20 },
    ];
    const adjustments: BudgetXlsxAdjustmentInput[] = [
      { amount: 200, sign: 1 },
      { amount: 50, sign: -1 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, adjustments);

    expect(totals.adjustments).toBe(150); // +200 - 50
    expect(totals.sale).toBeCloseTo(1200, 6);
    expect(totals.grandTotal).toBeCloseTo(1350, 6);
  });

  it("cenário combinado: tudo junto bate com calcGrandTotals", () => {
    const sections: BudgetXlsxSectionInput[] = [
      { id: "s1", title: "Estrutura", qty: 2, section_price: null },
      { id: "s2", title: "Acabamento", qty: 1, section_price: null },
      { id: "s3", title: "Descontos", qty: 1, section_price: null },
      { id: "s4", title: "Créditos", qty: 1, section_price: null },
    ];
    const items: BudgetXlsxItemInput[] = [
      { section_id: "s1", qty: 5, internal_unit_price: 100, internal_total: null, bdi_percentage: 30 },
      { section_id: "s2", qty: null, internal_unit_price: null, internal_total: 800, bdi_percentage: 25 },
      { section_id: "s2", qty: 3, internal_unit_price: 50, internal_total: null, bdi_percentage: 25 },
      { section_id: "s3", qty: 1, internal_unit_price: -100, internal_total: null, bdi_percentage: 0 },
      { section_id: "s4", qty: 1, internal_unit_price: -250, internal_total: null, bdi_percentage: 0 },
    ];
    const adjustments: BudgetXlsxAdjustmentInput[] = [
      { amount: 120, sign: 1 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, adjustments);
    const calcSecs = toCalcSections(sections, items);
    const grand = calcGrandTotals(calcSecs);

    expect(totals.cost).toBe(grand.cost);
    expect(totals.saleMargin).toBeCloseTo(grand.sale, 6);
    expect(totals.marginRatio).toBeCloseTo(grand.marginPercent / 100, 6);

    // Créditos abatem o total mostrado, descontos já estão dentro do grand.sale
    const creditSale = calcSectionSaleTotal(calcSecs[3]);
    expect(totals.creditTotal).toBeCloseTo(creditSale, 6);
    expect(totals.sale).toBeCloseTo(grand.sale + creditSale, 6);
    expect(totals.grandTotal).toBeCloseTo(totals.sale + 120, 6);
  });
});
