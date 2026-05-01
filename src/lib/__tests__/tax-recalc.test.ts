/**
 * Anti-regressão: o recálculo automático da linha "Impostos e despesas
 * administrativas" NUNCA pode persistir alterações numa versão publicada.
 *
 * Cenário real (2026-05-01):
 *  - Orçamento publicado é reaberto no editor.
 *  - Algum efeito (load, refetch, ação que reaproveita updateItem) dispara
 *    `recalcTaxItem` mesmo com `readOnly=true`.
 *  - Antes do guard, isso recalculava e gravava `internal_total`/`section_price`,
 *    alterando silenciosamente o valor que o cliente vê.
 *
 * Trava em três camadas:
 *  1) readOnly=true → estado original devolvido sem mutação
 *  2) readOnly=true → função `persist` NUNCA chamada
 *  3) disableTaxRecalc=true → idem (independente de readOnly)
 *  4) Sanidade: quando permitido, recalcula e persiste corretamente
 */
import { describe, it, expect, vi } from "vitest";
import { recalcTaxIfAllowed, type RecalcSection } from "@/lib/tax-recalc";
import { TAX_ITEM_TITLE, TAX_RATE } from "@/lib/default-budget-sections";

function makeSections(): RecalcSection[] {
  return [
    {
      id: "sec-1",
      section_price: 1000,
      items: [
        {
          id: "item-1",
          title: "Demolição",
          internal_total: 1000,
          internal_unit_price: 1000,
          qty: 1,
          bdi_percentage: 0,
        },
      ],
    },
    {
      id: "sec-tax",
      section_price: 60, // valor ANTIGO (snapshot publicado)
      items: [
        {
          id: "item-tax",
          title: TAX_ITEM_TITLE,
          internal_total: 60,
          internal_unit_price: 60,
          qty: 1,
          bdi_percentage: 0,
        },
      ],
    },
  ];
}

describe("recalcTaxIfAllowed — guard de versão publicada", () => {
  it("readOnly=true: NÃO chama persist e devolve referência original", () => {
    const sections = makeSections();
    const persist = vi.fn();

    const result = recalcTaxIfAllowed(sections, { readOnly: true, persist });

    expect(persist).not.toHaveBeenCalled();
    // Referência preservada (sem clone) — não dispara re-renders nem auto-save
    expect(result).toBe(sections);
    // Valor antigo da taxa permanece
    const tax = result[1].items.find((i) => i.title === TAX_ITEM_TITLE);
    expect(tax?.internal_total).toBe(60);
    expect(result[1].section_price).toBe(60);
  });

  it("readOnly=true mesmo SEM persist: ainda devolve original (dry-run também é bloqueado)", () => {
    const sections = makeSections();
    const result = recalcTaxIfAllowed(sections, { readOnly: true });
    expect(result).toBe(sections);
  });

  it("disableTaxRecalc=true: NÃO chama persist (independente de readOnly)", () => {
    const sections = makeSections();
    const persist = vi.fn();

    const result = recalcTaxIfAllowed(sections, {
      readOnly: false,
      disableTaxRecalc: true,
      persist,
    });

    expect(persist).not.toHaveBeenCalled();
    expect(result).toBe(sections);
  });

  it("readOnly=false: recalcula e persiste itens + seção da taxa", () => {
    // Subtotal das demais linhas = 1000 → taxa esperada = 60.00
    const sections = makeSections();
    // Simula que a taxa atual está desatualizada (cliente removeu um item)
    sections[0].items[0].internal_total = 2000;
    sections[0].items[0].internal_unit_price = 2000;

    const persist = vi.fn();
    const result = recalcTaxIfAllowed(sections, { readOnly: false, persist });

    const expectedTax = Math.round(2000 * TAX_RATE * 100) / 100; // 120
    const tax = result[1].items.find((i) => i.title === TAX_ITEM_TITLE);
    expect(tax?.internal_total).toBe(expectedTax);
    expect(tax?.internal_unit_price).toBe(expectedTax);
    expect(result[1].section_price).toBe(expectedTax);

    // Persistiu o item da taxa e o section_price
    expect(persist).toHaveBeenCalledWith(
      "items",
      "item-tax",
      expect.objectContaining({
        internal_total: expectedTax,
        internal_unit_price: expectedTax,
        qty: 1,
        bdi_percentage: 0,
      }),
    );
    expect(persist).toHaveBeenCalledWith(
      "sections",
      "sec-tax",
      expect.objectContaining({ section_price: expectedTax }),
    );
  });

  it("regressão: chamada repetida em readOnly NUNCA acumula side-effects", () => {
    const sections = makeSections();
    const persist = vi.fn();

    for (let i = 0; i < 10; i++) {
      const r = recalcTaxIfAllowed(sections, { readOnly: true, persist });
      expect(r).toBe(sections);
    }

    expect(persist).not.toHaveBeenCalled();
  });

  it("sem item de taxa no orçamento: devolve original mesmo quando editável", () => {
    const sections: RecalcSection[] = [
      {
        id: "sec-1",
        items: [
          { id: "item-1", title: "Pintura", internal_total: 500, internal_unit_price: 500, qty: 1, bdi_percentage: 0 },
        ],
      },
    ];
    const persist = vi.fn();
    const result = recalcTaxIfAllowed(sections, { readOnly: false, persist });
    expect(result).toBe(sections);
    expect(persist).not.toHaveBeenCalled();
  });
});
