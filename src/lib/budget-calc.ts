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
  title?: string | null;
  items: CalcItem[];
}

/** Section title constants used to flag abatement-style sections. */
export const DISCOUNT_SECTION_TITLE = "Descontos";
export const CREDIT_SECTION_TITLE = "Créditos";

const normalizeTitle = (t?: string | null): string =>
  (t ?? "").trim().toLowerCase();

/** True when the section is the dedicated discount bucket. */
export function isDiscountSection(section: { title?: string | null }): boolean {
  return normalizeTitle(section.title) === DISCOUNT_SECTION_TITLE.toLowerCase();
}

/** True when the section is the dedicated credit bucket.
 *  Credits reduce the total shown to the client but DO NOT affect internal margin. */
export function isCreditSection(section: { title?: string | null }): boolean {
  return normalizeTitle(section.title) === CREDIT_SECTION_TITLE.toLowerCase();
}

export function calcSaleUnitPrice(cost: number | null | undefined, bdi: number | null | undefined): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (1 + b / 100);
}

export function calcItemSaleTotal(item: CalcItem): number {
  const unitPrice = Number(item.internal_unit_price) || 0;
  // qty defaults to 1 when there is any unit price (positive or negative)
  const qty = Number(item.qty) || (unitPrice !== 0 ? 1 : 0);
  if (unitPrice !== 0) {
    return calcSaleUnitPrice(unitPrice, item.bdi_percentage) * qty;
  }
  // Fallback: use internal_total as sale price when no unit price
  const total = Number(item.internal_total) || 0;
  if (total !== 0) {
    // Apply BDI to fallback total as well
    const bdi = Number(item.bdi_percentage) || 0;
    return total * (1 + bdi / 100);
  }
  return 0;
}

export function calcItemCostTotal(item: CalcItem): number {
  const unitPrice = Number(item.internal_unit_price) || 0;
  // When unit price exists (positive or negative), cost = unit_price * qty
  if (unitPrice !== 0) {
    const qty = Number(item.qty) || 1;
    return unitPrice * qty;
  }
  // Fallback: internal_total as a LUMP-SUM (may be negative for discounts)
  const total = Number(item.internal_total) || 0;
  return total;
}

export function calcSectionCostTotal(section: CalcSection): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemCostTotal(i), 0);
    // Use item sum whenever there are items contributing (including negatives);
    // only fall back to section_price when ALL items are zero.
    const hasContribution = section.items.some((i) => calcItemCostTotal(i) !== 0);
    if (hasContribution) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

export function calcSectionSaleTotal(section: CalcSection): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemSaleTotal(i), 0);
    const hasContribution = section.items.some((i) => calcItemSaleTotal(i) !== 0);
    if (hasContribution) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

export function calcGrandTotals(sections: CalcSection[]) {
  // Credits are abatements that should not impact internal margin / BDI.
  // They still reduce the public total elsewhere, but here we exclude them
  // so the margin reflects the real production economics.
  const marginSections = sections.filter((s) => !isCreditSection(s));
  const cost = marginSections.reduce((sum, s) => sum + calcSectionCostTotal(s), 0);
  const sale = marginSections.reduce((sum, s) => sum + calcSectionSaleTotal(s), 0);
  const margin = sale - cost;
  const bdiPercent = cost > 0 ? ((sale / cost) - 1) * 100 : 0;
  const marginPercent = sale > 0 ? (margin / sale) * 100 : 0;
  return { cost, sale, margin, bdiPercent, marginPercent };
}
