/**
 * Deleção segura de orçamentos.
 *
 * Histórico:
 *   Antes existiam ao menos dois caminhos no admin que deletavam um budget
 *   sem checagem (`BudgetActionsMenu.deleteBudget` e `BudgetRequestsList.handleDelete`).
 *   Como `parent_budget_id` e `version_group_id` apontam para `budgets.id`,
 *   apagar a primeira versão do grupo (a "raiz") deixava todos os filhos com
 *   ponteiros órfãos. Em 2026-04-30 o banco tinha 45 budgets nessa situação.
 *
 * Este módulo expõe `safeDeleteBudget` que faz as checagens necessárias
 * **antes** de remover o budget, mantendo a integridade do versionamento.
 */
import { supabase } from "@/integrations/supabase/client";
import { logBudgetDeletion } from "@/lib/version-audit";

export interface SafeDeleteOptions {
  /** Pular checagem de current/published (caso o caller já tenha forçado outro current). NÃO use sem motivo. */
  force?: boolean;
  /** Usuário que iniciou a exclusão — usado no audit log. */
  userId?: string | null;
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
  // 1) Carrega o alvo
  const { data: target, error: loadErr } = await supabase
    .from("budgets")
    .select("id, status, is_current_version, is_published_version, version_group_id, version_number, parent_budget_id, public_id")
    .eq("id", budgetId)
    .maybeSingle();

  if (loadErr) return { ok: false, reason: `Falha ao carregar orçamento: ${loadErr.message}` };
  if (!target) return { ok: false, reason: "Orçamento não encontrado" };

  if (!options.force) {
    if (target.is_current_version) {
      return { ok: false, reason: "Não é possível excluir a versão atual. Promova outra como atual antes." };
    }
    if (target.is_published_version) {
      return { ok: false, reason: "Não é possível excluir a versão publicada. Despublique ou publique outra versão antes." };
    }
  }

  // 2) Verifica se outros budgets dependem deste como parent
  const { count: childCount, error: childErr } = await supabase
    .from("budgets")
    .select("id", { count: "exact", head: true })
    .eq("parent_budget_id", budgetId);
  if (childErr) return { ok: false, reason: `Falha ao verificar versões filhas: ${childErr.message}` };
  if ((childCount ?? 0) > 0) {
    return {
      ok: false,
      reason: `Existe(m) ${childCount} versão(ões) filha(s) que apontam para este orçamento. Exclua-as ou re-aponte antes.`,
    };
  }

  // 3) Verifica se este budget é a "raiz" do version_group (group_id == self.id)
  //    Apagar a raiz quebraria o version_group_id dos demais membros.
  if (target.version_group_id && target.version_group_id === budgetId) {
    const { count: groupCount, error: groupErr } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("version_group_id", budgetId)
      .neq("id", budgetId);
    if (groupErr) return { ok: false, reason: `Falha ao verificar grupo: ${groupErr.message}` };
    if ((groupCount ?? 0) > 0) {
      return {
        ok: false,
        reason: `Este orçamento é a raiz do grupo de versões e há ${groupCount} outra(s) versão(ões) no grupo. Não pode ser excluído.`,
      };
    }
  }

  // 4) Cleanup em cascata (tabelas filhas)
  const { data: sectionRows } = await supabase.from("sections").select("id").eq("budget_id", budgetId);
  const sectionIds = (sectionRows || []).map((s) => s.id);
  if (sectionIds.length > 0) {
    const { data: itemRows } = await supabase.from("items").select("id").in("section_id", sectionIds);
    const itemIds = (itemRows || []).map((i) => i.id);
    if (itemIds.length > 0) {
      await supabase.from("item_images").delete().in("item_id", itemIds);
      await supabase.from("items").delete().in("id", itemIds);
    }
    await supabase.from("sections").delete().in("id", sectionIds);
  }
  await supabase.from("adjustments").delete().eq("budget_id", budgetId);
  await supabase.from("rooms").delete().eq("budget_id", budgetId);
  await supabase.from("budget_tours").delete().eq("budget_id", budgetId);

  // 5) Finalmente, deleta o budget
  const { error: delErr } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (delErr) return { ok: false, reason: `Falha ao excluir orçamento: ${delErr.message}` };

  // 6) Audit log obrigatório (issue #14): registra a exclusão num registro
  // sobrevivente do mesmo grupo/parent. Tolerante a falhas — não reverte a deleção.
  try {
    await logBudgetDeletion({
      deletedBudgetId: budgetId,
      userId: options.userId ?? null,
      source: "safeDeleteBudget",
      parentBudgetId: target.parent_budget_id ?? null,
      versionGroupId: target.version_group_id ?? null,
      versionNumber: target.version_number ?? null,
      publicId: target.public_id ?? null,
      isCurrentVersion: target.is_current_version ?? false,
      isPublishedVersion: target.is_published_version ?? false,
      status: target.status ?? null,
    });
  } catch {
    /* audit é best-effort */
  }

  return { ok: true };
}
