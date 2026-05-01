/**
 * Soft-delete de orçamentos.
 *
 * Histórico:
 *   - Antes existiam ao menos dois caminhos no admin que deletavam um budget
 *     sem checagem (`BudgetActionsMenu.deleteBudget` e `BudgetRequestsList.handleDelete`).
 *     Como `parent_budget_id` e `version_group_id` apontam para `budgets.id`,
 *     apagar a primeira versão do grupo (a "raiz") deixava todos os filhos
 *     com ponteiros órfãos.
 *   - Em 2026-05-01 a exclusão passou a ser SOFT (campo `deleted_at`). Isso
 *     remove o orçamento da visão de comerciais, orçamentistas e do público
 *     via RLS, mas mantém os dados no banco para que admin possa restaurar
 *     em `/admin/lixeira`.
 *
 * `safeDeleteBudget` continua bloqueando exclusão da versão atual / publicada,
 * mas as checagens de "raiz do version_group" e "tem filhos" já não são
 * necessárias, porque nada é fisicamente removido.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SafeDeleteOptions {
  /** Pular checagem de current/published. NÃO use sem motivo. */
  force?: boolean;
}

export interface SafeDeleteFailure {
  ok: false;
  reason: string;
}

export interface SafeDeleteSuccess {
  ok: true;
}

export type SafeDeleteResult = SafeDeleteFailure | SafeDeleteSuccess;

export async function safeDeleteBudget(
  budgetId: string,
  options: SafeDeleteOptions = {}
): Promise<SafeDeleteResult> {
  const { data: target, error: loadErr } = await supabase
    .from("budgets")
    .select("id, status, is_current_version, is_published_version, deleted_at")
    .eq("id", budgetId)
    .maybeSingle();

  if (loadErr) return { ok: false, reason: `Falha ao carregar orçamento: ${loadErr.message}` };
  if (!target) return { ok: false, reason: "Orçamento não encontrado" };
  if (target.deleted_at) return { ok: false, reason: "Orçamento já está na lixeira" };

  if (!options.force) {
    if (target.is_current_version) {
      return {
        ok: false,
        reason: "Não é possível mover a versão atual para a lixeira. Promova outra como atual antes.",
      };
    }
    if (target.is_published_version) {
      return {
        ok: false,
        reason: "Não é possível mover a versão publicada para a lixeira. Despublique ou publique outra versão antes.",
      };
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const { error: updErr } = await supabase
    .from("budgets")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", budgetId);

  if (updErr) return { ok: false, reason: `Falha ao mover para lixeira: ${updErr.message}` };

  return { ok: true };
}

/** Restaura um orçamento da lixeira. Apenas admin (validado no RPC). */
export async function restoreBudget(budgetId: string): Promise<SafeDeleteResult> {
  const { error } = await supabase.rpc("restore_budget", { p_budget_id: budgetId });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Remove definitivamente um orçamento que JÁ ESTÁ na lixeira. Apenas admin. */
export async function purgeBudget(budgetId: string): Promise<SafeDeleteResult> {
  const { error } = await supabase.rpc("purge_budget", { p_budget_id: budgetId });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
