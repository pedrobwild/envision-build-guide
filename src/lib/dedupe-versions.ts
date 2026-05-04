/**
 * Dedupe defensivo de versões em listas de orçamentos.
 *
 * Mesmo que a query do Supabase filtre `is_current_version=true`, a base pode
 * ter mais de uma versão "current" no mesmo `version_group_id` (invariante
 * quebrado por bugs antigos de clonagem). Sem esse dedup, o Kanban mostra
 * cards duplicados (V8/V9/V10) que parecem o mesmo orçamento.
 *
 * Regra: por grupo, ficamos com 1 só linha — preferindo:
 *   1. a publicada (`is_published_version`), se existir;
 *   2. a de maior `version_number`;
 *   3. desempate pela mais recente em `created_at`.
 *
 * Linhas sem `version_group_id` (orçamentos antigos) passam direto.
 */
export interface VersionableBudget {
  id: string;
  version_group_id?: string | null;
  version_number?: number | null;
  is_current_version?: boolean | null;
  is_published_version?: boolean | null;
  created_at?: string | null;
}

export function dedupeBudgetsByVersionGroup<T extends VersionableBudget>(
  budgets: T[],
): T[] {
  const winners = new Map<string, T>();
  const passthrough: T[] = [];

  for (const budget of budgets) {
    const groupId = budget.version_group_id;
    if (!groupId) {
      passthrough.push(budget);
      continue;
    }

    const current = winners.get(groupId);
    if (!current) {
      winners.set(groupId, budget);
      continue;
    }

    if (preferBudget(budget, current)) {
      winners.set(groupId, budget);
    }
  }

  return [...winners.values(), ...passthrough];
}

function preferBudget<T extends VersionableBudget>(candidate: T, current: T): boolean {
  // 1. Publicada vence
  if (!!candidate.is_published_version !== !!current.is_published_version) {
    return !!candidate.is_published_version;
  }
  // 2. Maior version_number vence
  const candVer = candidate.version_number ?? 0;
  const currVer = current.version_number ?? 0;
  if (candVer !== currVer) return candVer > currVer;
  // 3. Mais recente vence
  const candDate = candidate.created_at ? new Date(candidate.created_at).getTime() : 0;
  const currDate = current.created_at ? new Date(current.created_at).getTime() : 0;
  return candDate > currDate;
}
