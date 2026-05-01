/**
 * Recálculo da linha de imposto (6%) sobre o subtotal das demais linhas.
 *
 * Extraído do `SectionsEditor` para testabilidade e para centralizar a
 * proteção da versão publicada: NUNCA recalcular nem persistir taxa numa
 * versão `readOnly` (publicada). Mesmo que efeitos de load/refetch tentem
 * disparar, o helper retorna o estado original sem side-effects.
 */

import { TAX_ITEM_TITLE, TAX_RATE } from "@/lib/default-budget-sections";
import { calcItemSaleTotal, calcItemCostTotal } from "@/lib/budget-calc";

export interface RecalcItem {
  id: string;
  title: string;
  internal_total?: number | null;
  internal_unit_price?: number | null;
  qty?: number | null;
  bdi_percentage?: number | null;
}

export interface RecalcSection {
  id: string;
  items: RecalcItem[];
  section_price?: number | null;
}

export type PersistFn = (
  logicalTable: "items" | "sections",
  id: string,
  updates: Record<string, unknown>,
) => void;

export interface RecalcOptions {
  readOnly: boolean;
  disableTaxRecalc?: boolean;
  /**
   * Persistência opcional. Quando ausente, o recálculo é "dry-run":
   * retorna o novo estado mas não dispara saves. O guard de readOnly
   * vale para AMBOS os casos — em readOnly o estado original é
   * devolvido inalterado.
   */
  persist?: PersistFn;
}

/**
 * Retorna sections atualizadas com a taxa recalculada. Se `readOnly` ou
 * `disableTaxRecalc`, devolve `currentSections` sem mutar e sem chamar persist.
 */
export function recalcTaxIfAllowed<T extends RecalcSection>(
  currentSections: T[],
  options: RecalcOptions,
): T[] {
  if (options.disableTaxRecalc) return currentSections;
  // Hard guard: versão publicada NUNCA recebe recálculo automático.
  if (options.readOnly) return currentSections;

  let taxSectionId: string | null = null;
  let taxItemId: string | null = null;

  for (const s of currentSections) {
    for (const i of s.items) {
      if (i.title === TAX_ITEM_TITLE) {
        taxSectionId = s.id;
        taxItemId = i.id;
        break;
      }
    }
    if (taxItemId) break;
  }

  if (!taxItemId || !taxSectionId) return currentSections;

  let totalExcludingTax = 0;
  for (const s of currentSections) {
    for (const i of s.items) {
      if (i.id === taxItemId) continue;
      const saleTotal = calcItemSaleTotal(i);
      totalExcludingTax += saleTotal > 0 ? saleTotal : calcItemCostTotal(i);
    }
  }

  const taxValue = Math.round(totalExcludingTax * TAX_RATE * 100) / 100;

  const updated = currentSections.map((s) => {
    if (s.id !== taxSectionId) return s;
    const newItems = s.items.map((i) => {
      if (i.id !== taxItemId) return i;
      return {
        ...i,
        internal_total: taxValue,
        internal_unit_price: taxValue,
        qty: 1,
        bdi_percentage: 0,
      };
    });
    const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
    return { ...s, items: newItems, section_price: newSaleTotal };
  });

  if (options.persist) {
    options.persist("items", taxItemId, {
      internal_total: taxValue,
      internal_unit_price: taxValue,
      qty: 1,
      bdi_percentage: 0,
    });
    const taxSection = updated.find((s) => s.id === taxSectionId);
    if (taxSection) {
      options.persist("sections", taxSectionId, {
        section_price: taxSection.section_price,
      });
    }
  }

  return updated;
}
