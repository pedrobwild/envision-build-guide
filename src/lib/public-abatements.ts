/**
 * Fonte única de cálculo de abatimentos para superfícies públicas
 * (mobile + desktop). Existe para impedir que o mobile volte a recalcular
 * descontos/créditos de forma manual divergente do desktop — bug histórico
 * em que `PublicBudget.tsx` somava por seção via `calculateSectionSubtotal`
 * e perdia abatimentos embutidos em seções com saldo positivo.
 *
 * Uso obrigatório em `PublicBudget.tsx` e `BudgetSummary.tsx`. Qualquer
 * tentativa de recalcular manualmente deve falhar a asserção em DEV.
 */

import {
  aggregateAbatementsByLabel,
  type AbatementLine,
} from "@/lib/budget-calc";
import type { BudgetSection } from "@/types/budget";
import { logger } from "@/lib/logger";

export interface PublicAbatementBreakdown {
  discounts: AbatementLine[];
  credits: AbatementLine[];
  discountTotal: number;
  creditTotal: number;
  /** Marca de origem — usada pela asserção em DEV para detectar reimplementações divergentes. */
  readonly __source: "aggregateAbatementsByLabel";
}

/**
 * Calcula o breakdown de abatimentos público SEMPRE via
 * `aggregateAbatementsByLabel` e adiciona uma marca `__source` que serve
 * como contrato runtime: qualquer caller que consumir esse objeto pode
 * (e deve, em DEV) chamar `assertPublicAbatementParity` para garantir que
 * o cálculo não foi sobrescrito.
 */
export function computePublicAbatements(
  sections: BudgetSection[],
): PublicAbatementBreakdown {
  const result = aggregateAbatementsByLabel(sections);
  return {
    discounts: result.discounts,
    credits: result.credits,
    discountTotal: result.discountTotal,
    creditTotal: result.creditTotal,
    __source: "aggregateAbatementsByLabel",
  };
}

/**
 * Asserção runtime (somente DEV) que garante:
 * 1. O breakdown veio de `computePublicAbatements` (marca `__source` válida).
 * 2. Os totais batem com um recálculo independente via
 *    `aggregateAbatementsByLabel` — ou seja, ninguém mutou o objeto.
 *
 * Em produção é no-op (zero overhead). Em DEV registra erro e lança em
 * casos críticos para forçar correção imediata.
 */
export function assertPublicAbatementParity(
  sections: BudgetSection[],
  breakdown: PublicAbatementBreakdown,
  surface: "mobile" | "desktop",
): void {
  if (!import.meta.env.DEV) return;

  // 1) Marca de origem
  if (breakdown.__source !== "aggregateAbatementsByLabel") {
    const msg = `[abatement-parity:${surface}] breakdown não veio de aggregateAbatementsByLabel — recalculo manual detectado, isso causa divergência mobile↔desktop`;
    logger.error(msg);
    throw new Error(msg);
  }

  // 2) Recalcula independente e compara
  const reference = aggregateAbatementsByLabel(sections);
  const EPS = 0.01; // tolera arredondamento de centavo

  const totalsMismatch =
    Math.abs(reference.discountTotal - breakdown.discountTotal) > EPS ||
    Math.abs(reference.creditTotal - breakdown.creditTotal) > EPS;

  const linesMismatch =
    reference.discounts.length !== breakdown.discounts.length ||
    reference.credits.length !== breakdown.credits.length ||
    reference.discounts.some(
      (l, i) =>
        l.label !== breakdown.discounts[i]?.label ||
        Math.abs(l.total - breakdown.discounts[i]!.total) > EPS,
    ) ||
    reference.credits.some(
      (l, i) =>
        l.label !== breakdown.credits[i]?.label ||
        Math.abs(l.total - breakdown.credits[i]!.total) > EPS,
    );

  if (totalsMismatch || linesMismatch) {
    const msg = `[abatement-parity:${surface}] divergência detectada — breakdown não bate com aggregateAbatementsByLabel(sections)`;
    logger.error(msg, { reference, breakdown });
    throw new Error(msg);
  }
}
