/**
 * Resolução do "total geral" de um orçamento.
 *
 * Regra única (memory: logic/budget/manual-total-source-of-truth):
 *  - Se `manual_total` for um número finito (incluindo zero), ele é a
 *    fonte da verdade. Reflete imports de PDF/Excel ou override manual.
 *  - Caso contrário, cai para o total computado a partir de seções/itens
 *    + ajustes (cálculo "venda + ajustes").
 *
 * Este helper deve ser usado por TODAS as superfícies que exibem o total
 * final ao cliente ou ao orçamentista: PublicBudget, PublicBudgetFallback,
 * BudgetInternalDetail/StickyEditorHeader, exports PDF e XLSX.
 */
export interface ResolveBudgetGrandTotalInput {
  /** Valor armazenado em `budgets.manual_total`. Aceita number, string numérica ou null/undefined. */
  manualTotal: number | string | null | undefined;
  /** Total calculado a partir de seções/itens + ajustes. */
  computedTotal: number;
}

export interface ResolvedBudgetGrandTotal {
  /** Valor final que deve ser exibido como "Total geral". */
  total: number;
  /** Origem do valor — útil para rotular ("Total geral" vs "Total geral (manual)"). */
  source: "manual" | "computed";
  /** Rótulo padrão recomendado para exibição. */
  label: "Total geral" | "Total geral (manual)";
}

/**
 * Normaliza `manual_total` e devolve o total efetivo + sua origem.
 * Não lança — entradas inválidas caem para o computado.
 */
export function resolveBudgetGrandTotal(
  input: ResolveBudgetGrandTotalInput,
): ResolvedBudgetGrandTotal {
  const { manualTotal, computedTotal } = input;
  const safeComputed = Number.isFinite(computedTotal) ? computedTotal : 0;

  if (manualTotal !== null && manualTotal !== undefined) {
    const asNum = typeof manualTotal === "string" ? Number(manualTotal) : manualTotal;
    if (typeof asNum === "number" && Number.isFinite(asNum)) {
      return {
        total: asNum,
        source: "manual",
        label: "Total geral (manual)",
      };
    }
  }

  return {
    total: safeComputed,
    source: "computed",
    label: "Total geral",
  };
}
