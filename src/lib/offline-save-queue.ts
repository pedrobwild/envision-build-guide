/**
 * Fila local persistente para alterações de campos do budget que falharam
 * por queda de rede ou timeout do banco. Garante que edições feitas pelo
 * usuário (ex.: trocar responsável, ajustar prazo) não sejam perdidas se
 * o save remoto falhar enquanto outras partes do orçamento ainda carregam.
 *
 * Estratégia:
 *  - Armazena pendências em localStorage (chave por budgetId).
 *  - Cada (campo) só guarda o último valor — saves subsequentes substituem.
 *  - Flush manual via `flushOfflineQueue` (chamado ao reconectar / ao montar).
 *  - Tudo silencioso: erros de flush apenas mantêm o item para nova tentativa.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const STORAGE_PREFIX = "budget-offline-queue:";

type Pending = Record<string, unknown>;

function keyFor(budgetId: string) {
  return `${STORAGE_PREFIX}${budgetId}`;
}

function readQueue(budgetId: string): Pending {
  try {
    const raw = localStorage.getItem(keyFor(budgetId));
    return raw ? (JSON.parse(raw) as Pending) : {};
  } catch {
    return {};
  }
}

function writeQueue(budgetId: string, queue: Pending) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(keyFor(budgetId));
    } else {
      localStorage.setItem(keyFor(budgetId), JSON.stringify(queue));
    }
  } catch (err) {
    logger.error("offline-save-queue: failed to persist", err);
  }
}

export function enqueueOfflineSave(
  budgetId: string,
  field: string,
  value: unknown,
) {
  if (!budgetId) return;
  const queue = readQueue(budgetId);
  queue[field] = value;
  writeQueue(budgetId, queue);
}

export function getPendingFields(budgetId: string): string[] {
  return Object.keys(readQueue(budgetId));
}

export function hasPending(budgetId: string): boolean {
  return getPendingFields(budgetId).length > 0;
}

/**
 * Tenta enviar todas as pendências em uma única UPDATE. Em caso de falha,
 * preserva a fila para nova tentativa. Retorna true se a fila foi esvaziada.
 */
export async function flushOfflineQueue(budgetId: string): Promise<boolean> {
  if (!budgetId) return true;
  const queue = readQueue(budgetId);
  const fields = Object.keys(queue);
  if (fields.length === 0) return true;

  const { error } = await supabase
    .from("budgets")
    .update(queue as Record<string, unknown>)
    .eq("id", budgetId);

  if (error) {
    logger.error("offline-save-queue: flush failed", error.message);
    return false;
  }
  writeQueue(budgetId, {});
  return true;
}

/**
 * Descarta a fila offline sem flushar. Usado quando o orçamento que estava
 * recebendo edições offline foi publicado (ou virou versão pública), caso
 * em que a fila NUNCA deve ser aplicada in-place — sob pena de alterar o
 * snapshot que o cliente vê. Idempotente.
 */
export function discardOfflineQueue(budgetId: string): void {
  if (!budgetId) return;
  writeQueue(budgetId, {});
}
