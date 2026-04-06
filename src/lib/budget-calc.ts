/** Shared financial calculation helpers for budget editor */

export interface CalcItem {
  qty?: number | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
}

export interface CalcSection {
  qty?: number | null;
  section_price?: number | null;
  items: CalcItem[];
}

export function calcSaleUnitPrice(cost: number | null | undefined, bdi: number | null | undefined): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (1 + b / 100);
}

export function calcItemSaleTotal(item: CalcItem): number {
  const unitPrice = Number(item.internal_unit_price) || 0;
  const qty = Number(item.qty) || (unitPrice > 0 ? 1 : 0);
  if (unitPrice > 0) {
    return calcSaleUnitPrice(unitPrice, item.bdi_percentage) * qty;
  }
  // Fallback: use internal_total as sale price when no unit price
  const total = Number(item.internal_total) || 0;
  if (total > 0) return total;
  return 0;
}

export function calcItemCostTotal(item: CalcItem): number {
  if (item.internal_total != null && Number(item.internal_total) > 0) return Number(item.internal_total);
  const qty = Number(item.qty) || 1;
  return (Number(item.internal_unit_price) || 0) * qty;
}

export function calcSectionCostTotal(section: CalcSection): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemCostTotal(i), 0);
    if (sum > 0) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

export function calcSectionSaleTotal(section: CalcSection): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemSaleTotal(i), 0);
    if (sum > 0) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

export function calcGrandTotals(sections: CalcSection[]) {
  const cost = sections.reduce((sum, s) => sum + calcSectionCostTotal(s), 0);
  const sale = sections.reduce((sum, s) => sum + calcSectionSaleTotal(s), 0);
  const margin = sale - cost;
  const bdiPercent = cost > 0 ? ((sale / cost) - 1) * 100 : 0;
  const marginPercent = sale > 0 ? (margin / sale) * 100 : 0;
  return { cost, sale, margin, bdiPercent, marginPercent };
}
