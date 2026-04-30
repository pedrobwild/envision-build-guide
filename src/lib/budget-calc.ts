/** Shared financial calculation helpers for budget editor */

export interface CalcItem {
  qty?: number | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
  title?: string | null;
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
    const hasContribution = section.items.some((i) => {
      const unitPrice = Number(i.internal_unit_price) || 0;
      if (unitPrice !== 0) return true;
      return (Number(i.internal_total) || 0) !== 0;
    });
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

/** Linha agregada de abatimento exibida ao cliente: rótulo + total absoluto (R$). */
export interface AbatementLine {
  label: string;
  total: number;
}

/** Agrupa abatimentos negativos por rótulo do item, separando descontos e créditos.
 *
 *  Regras:
 *  - Considera APENAS itens com contribuição de venda negativa (`calcItemSaleTotal < 0`).
 *  - O bucket é decidido pela seção: `isDiscountSection` → desconto, `isCreditSection` → crédito,
 *    qualquer outra seção com item negativo → desconto (fallback seguro, mantém comportamento
 *    histórico do `BudgetSummary`).
 *  - O rótulo vem de `item.title` (trim). Vazio → "Desconto" / "Crédito".
 *  - Itens com mesmo rótulo (case-insensitive, normalizando espaços) somam na mesma linha.
 *  - Valores são sempre positivos no retorno (representam o abatimento em módulo). */
export function aggregateAbatementsByLabel(sections: CalcSection[]): {
  discounts: AbatementLine[];
  credits: AbatementLine[];
  discountTotal: number;
  creditTotal: number;
} {
  const discountMap = new Map<string, { label: string; total: number }>();
  const creditMap = new Map<string, { label: string; total: number }>();

  for (const section of sections) {
    const isCredit = isCreditSection(section);
    const isDiscount = isDiscountSection(section);
    // Bucket: crédito tem prioridade quando aplicável; senão tudo negativo cai em desconto.
    const bucket = isCredit ? creditMap : discountMap;
    const fallbackLabel = isCredit ? "Crédito" : "Desconto";

    for (const item of section.items) {
      const sale = calcItemSaleTotal(item);
      if (sale >= 0) continue;
      // Só consideramos como abatimento itens dentro de seção de desconto/crédito,
      // OU itens isolados negativos em qualquer outra seção (compat histórica).
      if (!isCredit && !isDiscount) {
        // Mantém comportamento atual: soma no balde "desconto" sob rótulo genérico.
      }
      const rawLabel = (item.title ?? "").trim();
      const label = rawLabel || fallbackLabel;
      const key = label.toLowerCase().replace(/\s+/g, " ");
      const abs = Math.abs(sale);
      const existing = bucket.get(key);
      if (existing) existing.total += abs;
      else bucket.set(key, { label, total: abs });
    }
  }

  const discounts = Array.from(discountMap.values()).sort((a, b) => b.total - a.total);
  const credits = Array.from(creditMap.values()).sort((a, b) => b.total - a.total);
  const discountTotal = discounts.reduce((s, l) => s + l.total, 0);
  const creditTotal = credits.reduce((s, l) => s + l.total, 0);

  return { discounts, credits, discountTotal, creditTotal };
}

// ─── Validação e normalização de abatimentos ───────────────────────────────
//
// Defesas explícitas para garantir que:
//   1. Itens em seções "Descontos"/"Créditos" SEMPRE têm contribuição negativa
//      (`unit_price * qty` ou `internal_total` < 0). Se um operador digitar
//      um valor positivo por engano, ele seria somado ao custo/venda e
//      INFLARIA o orçamento — exatamente o oposto do esperado.
//   2. Itens negativos NÃO ficam soltos em seções produtivas, onde reduziriam
//      a margem real sem aparecer como abatimento ao cliente.
//   3. Créditos não tenham BDI ≠ 0 (créditos são abatimentos puros e não
//      passam por marcação comercial).
//
// `normalizeAbatementItem` força o sinal: se o item está em desconto/crédito
// e tem valor positivo, inverte para negativo. Não modifica o input — devolve
// uma cópia, preservando imutabilidade.

/** Sinaliza problemas detectados na estrutura do orçamento que poderiam
 *  distorcer o cálculo de margem ou o total mostrado ao cliente. */
export interface BudgetCalcIssue {
  kind:
    | "abatement_positive_value"      // item em desconto/crédito com valor ≥ 0
    | "negative_in_productive_section" // item negativo em seção produtiva
    | "credit_with_bdi";               // crédito com BDI ≠ 0
  sectionTitle: string;
  itemTitle: string;
  /** Valor de venda originalmente calculado (antes de normalização). */
  originalSale: number;
}

/** Devolve uma cópia do item com `internal_unit_price` / `internal_total`
 *  forçados a serem ≤ 0 e `bdi_percentage = 0` (créditos não têm BDI).
 *  Usado quando a seção é de Desconto ou Crédito. */
export function normalizeAbatementItem(
  item: CalcItem,
  opts: { isCredit: boolean },
): CalcItem {
  const flipIfPositive = (v: number | null | undefined): number | null | undefined => {
    if (v == null) return v;
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    return n > 0 ? -n : n;
  };
  return {
    ...item,
    internal_unit_price: flipIfPositive(item.internal_unit_price),
    internal_total: flipIfPositive(item.internal_total),
    // Créditos não recebem BDI; descontos podem manter (raramente útil).
    bdi_percentage: opts.isCredit ? 0 : item.bdi_percentage,
  };
}

/** Aplica `normalizeAbatementItem` em todas as seções de Desconto/Crédito.
 *  Seções produtivas passam intactas. */
export function normalizeBudgetSections(sections: CalcSection[]): CalcSection[] {
  return sections.map((sec) => {
    const isCredit = isCreditSection(sec);
    const isDiscount = isDiscountSection(sec);
    if (!isCredit && !isDiscount) return sec;
    return {
      ...sec,
      items: sec.items.map((it) => normalizeAbatementItem(it, { isCredit })),
    };
  });
}

/** Auditoria: lista violações sem mutar nada. Útil para logar avisos
 *  durante o export e para testes que verificam detecção de problemas. */
export function validateBudgetCalcStructure(sections: CalcSection[]): BudgetCalcIssue[] {
  const issues: BudgetCalcIssue[] = [];
  for (const sec of sections) {
    const isCredit = isCreditSection(sec);
    const isDiscount = isDiscountSection(sec);
    const secTitle = (sec.title ?? "").trim() || "(sem título)";
    for (const it of sec.items) {
      const sale = calcItemSaleTotal(it);
      const cost = calcItemCostTotal(it);
      const itTitle = (it.title ?? "").trim() || "(sem título)";

      if (isCredit || isDiscount) {
        // Em seção de abatimento, item DEVE ser negativo (sale < 0 ou cost < 0).
        // Item totalmente zerado é ignorado (linha em branco, sem efeito).
        if (sale > 0 || cost > 0) {
          issues.push({
            kind: "abatement_positive_value",
            sectionTitle: secTitle,
            itemTitle: itTitle,
            originalSale: sale,
          });
        }
        if (isCredit && (Number(it.bdi_percentage) || 0) !== 0) {
          issues.push({
            kind: "credit_with_bdi",
            sectionTitle: secTitle,
            itemTitle: itTitle,
            originalSale: sale,
          });
        }
      } else if (sale < 0 || cost < 0) {
        // Item negativo solto em seção produtiva: corrói margem invisivelmente.
        issues.push({
          kind: "negative_in_productive_section",
          sectionTitle: secTitle,
          itemTitle: itTitle,
          originalSale: sale,
        });
      }
    }
  }
  return issues;
}
