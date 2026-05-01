/**
 * Política central de proteção da versão publicada.
 *
 * Centraliza a decisão "esta operação automática pode tocar na versão publicada?"
 * para que UI, hooks e testes compartilhem exatamente a mesma regra. Mudanças
 * de comportamento devem acontecer aqui — nunca duplicadas em call sites.
 *
 * Princípio: NENHUMA escrita "passiva" (auto-save em fila offline, recálculo
 * de taxa, normalizações de carga) pode persistir num orçamento marcado como
 * `is_published_version=true`. Edições legítimas pós-publicação só acontecem
 * via fluxo explícito de fork-em-rascunho.
 */

import { discardOfflineQueue, flushOfflineQueue, hasPending } from "./offline-save-queue";

export type FlushDecision =
  | { action: "skip"; reason: "no-budget-id" | "no-pending" }
  | { action: "discard"; reason: "published-version" }
  | { action: "flush" };

/**
 * Decide o que fazer com a fila offline ao montar o editor para um
 * orçamento. Pura — não toca em rede nem em storage. Útil para testes.
 */
export function decideOfflineFlush(params: {
  budgetId: string | null | undefined;
  isPublishedVersion: boolean;
  hasPendingFn?: (id: string) => boolean;
}): FlushDecision {
  const { budgetId, isPublishedVersion } = params;
  const checkPending = params.hasPendingFn ?? hasPending;

  if (!budgetId) return { action: "skip", reason: "no-budget-id" };
  if (!checkPending(budgetId)) return { action: "skip", reason: "no-pending" };
  if (isPublishedVersion) return { action: "discard", reason: "published-version" };
  return { action: "flush" };
}

/**
 * Executa a decisão. Retorna a decisão tomada para que o caller possa
 * disparar feedback (toast, status) coerente.
 */
export async function applyOfflineFlushDecision(params: {
  budgetId: string | null | undefined;
  isPublishedVersion: boolean;
}): Promise<{ decision: FlushDecision; flushed?: boolean }> {
  const decision = decideOfflineFlush(params);
  if (decision.action === "skip") return { decision };
  if (decision.action === "discard") {
    discardOfflineQueue(params.budgetId as string);
    return { decision };
  }
  const flushed = await flushOfflineQueue(params.budgetId as string);
  return { decision, flushed };
}
