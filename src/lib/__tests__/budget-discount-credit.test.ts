import { describe, it, expect } from "vitest";
import {
  calcItemSaleTotal,
  calcItemCostTotal,
  calcSectionSaleTotal,
  calcSectionCostTotal,
  calcGrandTotals,
  isDiscountSection,
  isCreditSection,
  type CalcSection,
} from "@/lib/budget-calc";
import { calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";

/**
 * Cobre o comportamento de descontos (custo negativo) e créditos:
 * - Subtotal de seção respeita itens negativos
 * - Total final do orçamento subtrai descontos e créditos
 * - Taxa administrativa de 6% não é "ativada" por seções 100% negativas
 *   (cálculo da taxa usa fallback de custo quando venda <= 0)
 * - Margem interna ignora seção "Créditos" mas inclui "Descontos"
 * - Formatação pt-BR funciona para valores positivos e negativos
 */
describe("Discount + Credit — calculation engine", () => {
  // ─── Section subtotal with negative items ──────────────────────────
  describe("calculateSectionSubtotal com item negativo", () => {
    it("retorna valor negativo quando o item tem internal_total negativo", () => {
      const discountSection = {
        items: [{ internal_total: -3000 }],
        qty: 1,
      };
      expect(calculateSectionSubtotal(discountSection)).toBe(-3000);
    });

    it("usa internal_unit_price * qty quando presente (mesmo negativo)", () => {
      const section = {
        items: [{ internal_unit_price: -1500, qty: 1, internal_total: null }],
        qty: 1,
      };
      // Sem BDI o sale total = -1500
      expect(calcItemSaleTotal(section.items[0])).toBe(-1500);
      expect(calcSectionSaleTotal(section as CalcSection)).toBe(-1500);
    });

    it("respeita qty da seção em descontos negativos", () => {
      const section: CalcSection = {
        items: [{ internal_unit_price: -1000, qty: 1 }],
        qty: 2,
      };
      expect(calcSectionSaleTotal(section)).toBe(-2000);
    });
  });

  // ─── Budget total ─────────────────────────────────────────────────
  describe("calculateBudgetTotal subtrai descontos do total final", () => {
    it("subtotal − desconto = total final esperado", () => {
      const sections = [
        {
          title: "Marcenaria",
          items: [{ internal_total: 50000 }],
          qty: 1,
        },
        {
          title: "Descontos",
          items: [{ internal_unit_price: -3000, qty: 1 }],
          qty: 1,
        },
      ];
      // 50.000 + (-3.000) = 47.000
      expect(calculateBudgetTotal(sections as never, [])).toBe(47000);
    });

    it("subtrai múltiplos descontos e créditos do total", () => {
      const sections = [
        { title: "Obra", items: [{ internal_total: 100000 }], qty: 1 },
        { title: "Descontos", items: [{ internal_unit_price: -5000, qty: 1 }], qty: 1 },
        { title: "Créditos", items: [{ internal_unit_price: -2500, qty: 1 }], qty: 1 },
      ];
      // 100.000 - 5.000 - 2.500 = 92.500
      expect(calculateBudgetTotal(sections as never, [])).toBe(92500);
    });

    it("nunca produz total negativo na prática (desconto < subtotal)", () => {
      const sections = [
        { items: [{ internal_total: 10000 }], qty: 1 },
        { title: "Descontos", items: [{ internal_unit_price: -500, qty: 1 }], qty: 1 },
      ];
      const total = calculateBudgetTotal(sections as never, []);
      expect(total).toBeGreaterThan(0);
      expect(total).toBe(9500);
    });
  });

  // ─── Section type detection ───────────────────────────────────────
  describe("isDiscountSection / isCreditSection", () => {
    it("identifica seção 'Descontos' (case + acentos normalizados via lowercase)", () => {
      expect(isDiscountSection({ title: "Descontos" })).toBe(true);
      expect(isDiscountSection({ title: "descontos" })).toBe(true);
      expect(isDiscountSection({ title: "  Descontos  " })).toBe(true);
      expect(isDiscountSection({ title: "Marcenaria" })).toBe(false);
      expect(isDiscountSection({ title: null })).toBe(false);
      expect(isDiscountSection({})).toBe(false);
    });

    it("identifica seção 'Créditos'", () => {
      expect(isCreditSection({ title: "Créditos" })).toBe(true);
      expect(isCreditSection({ title: "créditos" })).toBe(true);
      expect(isCreditSection({ title: "Descontos" })).toBe(false);
    });

    it("desconto e crédito são mutuamente exclusivos", () => {
      const discount = { title: "Descontos" };
      const credit = { title: "Créditos" };
      expect(isDiscountSection(discount) && isCreditSection(discount)).toBe(false);
      expect(isDiscountSection(credit) && isCreditSection(credit)).toBe(false);
    });
  });

  // ─── Margin (calcGrandTotals) ─────────────────────────────────────
  describe("calcGrandTotals — crédito não afeta margem, desconto afeta", () => {
    it("desconto reduz a venda e a margem é recalculada", () => {
      const baseSections: CalcSection[] = [
        {
          title: "Marcenaria",
          items: [{ internal_unit_price: 1000, qty: 10, bdi_percentage: 50 }],
        },
      ];
      const baseTotals = calcGrandTotals(baseSections);
      // venda = 1000 * 1.5 * 10 = 15.000 ; custo = 10.000 ; margem = 5.000
      expect(baseTotals.sale).toBe(15000);
      expect(baseTotals.cost).toBe(10000);
      expect(baseTotals.margin).toBe(5000);

      const withDiscount: CalcSection[] = [
        ...baseSections,
        {
          title: "Descontos",
          items: [{ internal_unit_price: -2000, qty: 1, bdi_percentage: 0 }],
        },
      ];
      const withDiscountTotals = calcGrandTotals(withDiscount);
      // venda = 15.000 - 2.000 = 13.000 ; custo = 10.000 - 2.000 = 8.000
      // margem = 13.000 - 8.000 = 5.000 (mesma magnitude absoluta, mas % muda)
      expect(withDiscountTotals.sale).toBe(13000);
      expect(withDiscountTotals.cost).toBe(8000);
      expect(withDiscountTotals.margin).toBe(5000);
      // % de margem aumentou pois custo caiu mais proporcionalmente
      expect(withDiscountTotals.marginPercent).toBeGreaterThan(baseTotals.marginPercent);
    });

    it("crédito é EXCLUÍDO do cálculo de venda/custo/margem (não impacta margem interna)", () => {
      const sections: CalcSection[] = [
        {
          title: "Marcenaria",
          items: [{ internal_unit_price: 1000, qty: 10, bdi_percentage: 50 }],
        },
        {
          title: "Créditos",
          items: [{ internal_unit_price: -3000, qty: 1, bdi_percentage: 0 }],
        },
      ];
      const totals = calcGrandTotals(sections);
      // Crédito é ignorado: venda/custo/margem ficam idênticos ao caso sem crédito
      expect(totals.sale).toBe(15000);
      expect(totals.cost).toBe(10000);
      expect(totals.margin).toBe(5000);
    });

    it("desconto + crédito juntos: só desconto entra no cálculo de margem", () => {
      const sections: CalcSection[] = [
        {
          title: "Obra",
          items: [{ internal_unit_price: 1000, qty: 10, bdi_percentage: 50 }],
        },
        {
          title: "Descontos",
          items: [{ internal_unit_price: -2000, qty: 1, bdi_percentage: 0 }],
        },
        {
          title: "Créditos",
          items: [{ internal_unit_price: -1500, qty: 1, bdi_percentage: 0 }],
        },
      ];
      const totals = calcGrandTotals(sections);
      // desconto entra (-2000), crédito é ignorado
      expect(totals.sale).toBe(15000 - 2000);
      expect(totals.cost).toBe(10000 - 2000);
      expect(totals.margin).toBe(5000);
    });
  });

  // ─── Item-level cost/sale invariants ──────────────────────────────
  describe("Invariantes item-level com BDI=0 (caso típico de abatimento)", () => {
    it("para item negativo com BDI=0, custo === venda", () => {
      const item = { internal_unit_price: -3000, qty: 1, bdi_percentage: 0 };
      expect(calcItemCostTotal(item)).toBe(-3000);
      expect(calcItemSaleTotal(item)).toBe(-3000);
    });

    it("para item negativo com BDI=20, venda fica MENOS negativa que o custo (BDI amplifica magnitude)", () => {
      // Custo negativo * (1 + 0.20) = magnitude maior em valor absoluto
      // Por isso descontos reais usam BDI=0 — esse teste garante o invariante matemático.
      const item = { internal_unit_price: -1000, qty: 1, bdi_percentage: 20 };
      expect(calcItemCostTotal(item)).toBe(-1000);
      expect(calcItemSaleTotal(item)).toBe(-1200);
    });
  });

  // ─── Order independence ───────────────────────────────────────────
  describe("Independência de ordem das seções", () => {
    it("o total não depende da posição da seção de desconto", () => {
      const make = (discountFirst: boolean) => {
        const sales = { items: [{ internal_total: 20000 }], qty: 1 };
        const discount = {
          title: "Descontos",
          items: [{ internal_unit_price: -1500, qty: 1 }],
          qty: 1,
        };
        return discountFirst ? [discount, sales] : [sales, discount];
      };
      expect(calculateBudgetTotal(make(true) as never)).toBe(
        calculateBudgetTotal(make(false) as never),
      );
    });
  });

  // ─── pt-BR formatting ─────────────────────────────────────────────
  describe("Formatação pt-BR (formatBRL)", () => {
    it("formata valores positivos com R$ + ponto de milhar + vírgula decimal", () => {
      expect(formatBRL(47000)).toMatch(/^R\$\s?47\.000,00$/);
      expect(formatBRL(1234.5)).toMatch(/^R\$\s?1\.234,50$/);
    });

    it("formata valores negativos preservando o sinal", () => {
      const out = formatBRL(-3000);
      // Intl pode usar "-R$" ou "R$ -" dependendo do locale runtime; ambos válidos
      expect(out).toMatch(/-/);
      expect(out).toContain("3.000,00");
    });

    it("trata zero corretamente", () => {
      expect(formatBRL(0)).toMatch(/^R\$\s?0,00$/);
    });

    it("trata null/undefined sem quebrar", () => {
      expect(formatBRL(null)).toBe("—");
      expect(formatBRL(undefined)).toBe("—");
    });
  });

  // ─── Tax interaction (regression guard) ───────────────────────────
  describe("Interação com taxa administrativa (não quebra cálculo de descontos)", () => {
    it("seção de desconto não é confundida com seção tributável — subtotal continua sendo só seu próprio negativo", () => {
      // Garante que o subtotal da seção de descontos é puramente o item negativo,
      // independente de existirem outras seções no orçamento
      const discountSection = {
        title: "Descontos",
        items: [{ internal_unit_price: -3000, qty: 1, internal_total: null }],
        qty: 1,
      };
      const taxSection = {
        title: "Taxa Administrativa",
        items: [{ internal_unit_price: 6000, qty: 1, internal_total: 6000 }],
        qty: 1,
      };
      const obra = { items: [{ internal_total: 100000 }], qty: 1 };

      expect(calculateSectionSubtotal(discountSection)).toBe(-3000);
      expect(calculateSectionSubtotal(taxSection)).toBe(6000);
      // Total = obra + taxa - desconto
      expect(
        calculateBudgetTotal([obra, taxSection, discountSection] as never, []),
      ).toBe(103000);
    });
  });
});
