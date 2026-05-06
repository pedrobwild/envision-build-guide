/**
 * Fila local persistente de updates pendentes em itens/seções de orçamento.
 * Complementa o auto-save com debounce de SectionsEditor: se o usuário fechar
 * a aba, perder conexão ou der refresh durante a janela de debounce (600ms)
 * — ou se o UPDATE remoto falhar — as alterações ficam em localStorage e são
 * reenviadas no próximo mount/online.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const STORAGE_PREFIX = "budget-sections-offline-queue:";

type RowKey = string; // `${actualTable}:${id}`
type Pending = Record<RowKey, Record<string, unknown>>;

function keyFor(budgetId: string) {
  return `${STORAGE_PREFIX}${budgetId}`;
}

function read(budgetId: string): Pending {
  try {
    const raw = localStorage.getItem(keyFor(budgetId));
    return raw ? (JSON.parse(raw) as Pending) : {};
  } catch {
    return {};
  }
}

function write(budgetId: string, queue: Pending) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(keyFor(budgetId));
    } else {
      localStorage.setItem(keyFor(budgetId), JSON.stringify(queue));
    }
  } catch (err) {
    logger.error("sections-offline-queue: persist failed", err);
  }
}

export function enqueueRowUpdate(
  budgetId: string,
  actualTable: string,
  id: string,
  updates: Record<string, unknown>,
) {
  if (!budgetId || !actualTable || !id) return;
  const queue = read(budgetId);
  const k = `${actualTable}:${id}`;
  queue[k] = { ...(queue[k] ?? {}), ...updates };
  write(budgetId, queue);
}

export function hasSectionsPending(budgetId: string): boolean {
  return Object.keys(read(budgetId)).length > 0;
}

/**
 * Envia todas as pendências em paralelo. Mantém na fila apenas as que falharem.
 */
export async function flushSectionsQueue(budgetId: string): Promise<boolean> {
  if (!budgetId) return true;
  const queue = read(budgetId);
  const entries = Object.entries(queue);
  if (entries.length === 0) return true;

  const remaining: Pending = {};
  await Promise.all(
    entries.map(async ([k, updates]) => {
      const [actualTable, id] = k.split(":");
      if (!actualTable || !id) return;
      try {
        const { error } = await supabase
          .from(actualTable as never)
          .update(updates as never)
          .eq("id", id);
        if (error) {
          remaining[k] = updates;
          logger.error("sections-offline-queue: flush row failed", actualTable, id, error.message);
        }
      } catch (err) {
        remaining[k] = updates;
        logger.error("sections-offline-queue: flush row threw", err);
      }
    }),
  );

  write(budgetId, remaining);
  return Object.keys(remaining).length === 0;
}
