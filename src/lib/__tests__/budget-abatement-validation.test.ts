/**
 * Validação e normalização de seções de abatimento (Descontos / Créditos).
 *
 * Garante que:
 *  - `validateBudgetCalcStructure` detecta:
 *      • valor positivo em seção de Desconto/Crédito
 *      • crédito com BDI ≠ 0
 *      • item negativo em seção produtiva (corroeria margem invisivelmente)
 *  - `normalizeAbatementItem` força sinal negativo e zera BDI quando crédito.
 *  - `normalizeBudgetSections` aplica a normalização SOMENTE em seções de
 *    abatimento, deixando seções produtivas intactas.
 *  - O export `computeBudgetXlsxTotals` aplica a normalização ANTES de
 *    calcular, então um operador que digite valor positivo num desconto
 *    ainda produz o efeito esperado (abatimento), e devolve `warnings`.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeAbatementItem,
  normalizeBudgetSections,
  validateBudgetCalcStructure,
  calcGrandTotals,
  type CalcSection,
} from "@/lib/budget-calc";
import { computeBudgetXlsxTotals } from "@/lib/budget-xlsx-export";

describe("normalizeAbatementItem", () => {
  it("inverte unit_price positivo para negativo", () => {
    const out = normalizeAbatementItem(
      { qty: 1, internal_unit_price: 500, bdi_percentage: 0 },
      { isCredit: false },
    );
    expect(out.internal_unit_price).toBe(-500);
  });

  it("preserva unit_price já negativo", () => {
    const out = normalizeAbatementItem(
      { qty: 1, internal_unit_price: -500, bdi_percentage: 0 },
      { isCredit: false },
    );
    expect(out.internal_unit_price).toBe(-500);
  });

  it("inverte internal_total positivo (lump-sum)", () => {
    const out = normalizeAbatementItem(
      { qty: null, internal_unit_price: null, internal_total: 800 },
      { isCredit: false },
    );
    expect(out.internal_total).toBe(-800);
  });

  it("zera BDI quando é crédito", () => {
    const out = normalizeAbatementItem(
      { qty: 1, internal_unit_price: -200, bdi_percentage: 30 },
      { isCredit: true },
    );
    expect(out.bdi_percentage).toBe(0);
  });

  it("preserva BDI em desconto (não-crédito)", () => {
    const out = normalizeAbatementItem(
      { qty: 1, internal_unit_price: -200, bdi_percentage: 30 },
      { isCredit: false },
    );
    expect(out.bdi_percentage).toBe(30);
  });

  it("não muta o input", () => {
    const input = { qty: 1, internal_unit_price: 500, bdi_percentage: 10 };
    normalizeAbatementItem(input, { isCredit: true });
    expect(input.internal_unit_price).toBe(500);
    expect(input.bdi_percentage).toBe(10);
  });
});

describe("normalizeBudgetSections", () => {
  it("normaliza seção de Descontos e mantém seções produtivas intactas", () => {
    const sections: CalcSection[] = [
      {
        title: "Reforma",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: 1000, bdi_percentage: 30 }],
      },
      {
        title: "Descontos",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: 200, bdi_percentage: 0 }],
      },
    ];
    const out = normalizeBudgetSections(sections);
    expect(out[0].items[0].internal_unit_price).toBe(1000); // produtiva intacta
    expect(out[1].items[0].internal_unit_price).toBe(-200); // desconto invertido
  });

  it("zera BDI em seção de Créditos", () => {
    const sections: CalcSection[] = [
      {
        title: "Créditos",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: -300, bdi_percentage: 25 }],
      },
    ];
    const out = normalizeBudgetSections(sections);
    expect(out[0].items[0].bdi_percentage).toBe(0);
  });
});

describe("validateBudgetCalcStructure", () => {
  it("detecta valor positivo em seção de Descontos", () => {
    const issues = validateBudgetCalcStructure([
      {
        title: "Descontos",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: 500, title: "Erro de digitação" }],
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("abatement_positive_value");
    expect(issues[0].itemTitle).toBe("Erro de digitação");
  });

  it("detecta crédito com BDI ≠ 0", () => {
    const issues = validateBudgetCalcStructure([
      {
        title: "Créditos",
        qty: 1,
        items: [
          { qty: 1, internal_unit_price: -300, bdi_percentage: 20, title: "Crédito X" },
        ],
      },
    ]);
    // Espera DOIS avisos: crédito com BDI + (também checa positivo, mas aqui é negativo, então só BDI)
    expect(issues.some((i) => i.kind === "credit_with_bdi")).toBe(true);
  });

  it("detecta item negativo em seção produtiva", () => {
    const issues = validateBudgetCalcStructure([
      {
        title: "Acabamento",
        qty: 1,
        items: [
          { qty: 1, internal_unit_price: -100, title: "Desconto solto" },
        ],
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("negative_in_productive_section");
  });

  it("não reporta nada em estrutura limpa", () => {
    const issues = validateBudgetCalcStructure([
      {
        title: "Reforma",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: 1000, bdi_percentage: 30 }],
      },
      {
        title: "Descontos",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: -200 }],
      },
      {
        title: "Créditos",
        qty: 1,
        items: [{ qty: 1, internal_unit_price: -500, bdi_percentage: 0 }],
      },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("computeBudgetXlsxTotals — normalização defensiva", () => {
  it("desconto digitado como POSITIVO ainda abate o total (e gera warning)", () => {
    const sections = [
      { id: "s1", title: "Reforma", qty: 1, section_price: null },
      { id: "s2", title: "Descontos", qty: 1, section_price: null },
    ];
    const items = [
      { section_id: "s1", qty: 1, internal_unit_price: 1000, internal_total: null, bdi_percentage: 30 },
      // Operador digitou 200 (positivo) num desconto — deveria ter sido -200.
      { section_id: "s2", qty: 1, internal_unit_price: 200, internal_total: null, bdi_percentage: 0, title: "Desconto X" },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);

    // Custo: 1000 - 200 (normalizado) = 800
    expect(totals.cost).toBe(800);
    // Venda: 1300 - 200 = 1100
    expect(totals.sale).toBeCloseTo(1100, 6);
    expect(totals.warnings).toHaveLength(1);
    expect(totals.warnings[0].kind).toBe("abatement_positive_value");
    expect(totals.warnings[0].sectionTitle).toBe("Descontos");
  });

  it("crédito com BDI tem BDI ignorado e abate sale (não margem)", () => {
    const sections = [
      { id: "s1", title: "Obra", qty: 1, section_price: null },
      { id: "s2", title: "Créditos", qty: 1, section_price: null },
    ];
    const items = [
      { section_id: "s1", qty: 1, internal_unit_price: 2000, internal_total: null, bdi_percentage: 25 },
      // BDI=50 num crédito é erro — deve ser ignorado.
      { section_id: "s2", qty: 1, internal_unit_price: -400, internal_total: null, bdi_percentage: 50, title: "Crédito" },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);

    // Margem (sem créditos): cost=2000, sale=2500
    expect(totals.cost).toBe(2000);
    expect(totals.saleMargin).toBeCloseTo(2500, 6);
    // Crédito abatido SEM BDI: -400 (não -600)
    expect(totals.creditTotal).toBeCloseTo(-400, 6);
    expect(totals.sale).toBeCloseTo(2100, 6);
    expect(totals.warnings.some((w) => w.kind === "credit_with_bdi")).toBe(true);
  });

  it("estrutura limpa não gera warnings e mantém paridade com calcGrandTotals", () => {
    const sections = [
      { id: "s1", title: "Obra", qty: 1, section_price: null },
      { id: "s2", title: "Descontos", qty: 1, section_price: null },
    ];
    const items = [
      { section_id: "s1", qty: 2, internal_unit_price: 500, internal_total: null, bdi_percentage: 20 },
      { section_id: "s2", qty: 1, internal_unit_price: -150, internal_total: null, bdi_percentage: 0 },
    ];
    const totals = computeBudgetXlsxTotals(sections, items, []);
    const grand = calcGrandTotals([
      { qty: 1, items: [{ qty: 2, internal_unit_price: 500, bdi_percentage: 20 }] },
      { title: "Descontos", qty: 1, items: [{ qty: 1, internal_unit_price: -150 }] },
    ]);

    expect(totals.warnings).toEqual([]);
    expect(totals.cost).toBe(grand.cost);
    expect(totals.saleMargin).toBeCloseTo(grand.sale, 6);
  });
});
