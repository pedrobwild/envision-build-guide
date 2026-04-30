/**
 * Abertura segura do orçamento público a partir do admin.
 *
 * Garante que o link aberto (botão "Visualizar") sempre aponte para uma
 * versão acessível por anônimos — `status IN ('published','minuta_solicitada')`
 * — evitando "Página não encontrada" quando o orçamento atual está em
 * draft mas existe outra versão publicada no mesmo grupo.
 *
 * Estratégia (em ordem):
 *   1. Se o budget passado já estiver publicado → abre direto.
 *   2. Senão, procura no `version_group_id` (ou no próprio id como fallback)
 *      a versão publicada mais recente e abre o public_id dela.
 *   3. Se nada estiver publicado e `autoPublish=true`, publica este budget
 *      (status → 'published') e abre.
 *   4. Se `autoPublish=false` e não houver versão publicada, mostra toast
 *      explicando o motivo e não abre nada.
 */
import { supabase } from "@/integrations/supabase/client";
import { getPublicBudgetUrl } from "./getPublicUrl";
import { toast } from "sonner";

interface BudgetRefForPublicOpen {
  id: string;
  public_id: string | null;
  status: string | null;
  version_group_id?: string | null;
}

interface OpenPublicBudgetOptions {
  /** Se true, publica o orçamento atual quando não houver nenhuma versão publicada. Default: true */
  autoPublish?: boolean;
  /** Callback opcional disparado quando o status do budget atual muda (ex: para atualizar UI local). */
  onStatusChanged?: (newStatus: string) => void;
}

const PUBLISHABLE = new Set(["published", "minuta_solicitada"]);

export async function openPublicBudget(
  budget: BudgetRefForPublicOpen,
  opts: OpenPublicBudgetOptions = {},
): Promise<void> {
  const { autoPublish = true, onStatusChanged } = opts;

  // 1) Já publicado: abre direto.
  if (budget.public_id && PUBLISHABLE.has(budget.status ?? "")) {
    window.open(getPublicBudgetUrl(budget.public_id), "_blank", "noopener,noreferrer");
    return;
  }

  // 2) Procura outra versão publicada no mesmo grupo.
  const groupId = budget.version_group_id ?? budget.id;
  const { data: published, error: pubErr } = await supabase
    .from("budgets")
    .select("id, public_id, status, version_number, created_at")
    .or(`version_group_id.eq.${groupId},id.eq.${groupId}`)
    .in("status", ["published", "minuta_solicitada"])
    .not("public_id", "is", null)
    .order("version_number", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (pubErr) {
    toast.error("Erro ao localizar versão publicada: " + pubErr.message);
    return;
  }

  const fallback = published?.[0];
  if (fallback?.public_id) {
    window.open(getPublicBudgetUrl(fallback.public_id), "_blank", "noopener,noreferrer");
    return;
  }

  // 3) Nada publicado: publica este orçamento (se autorizado) e abre.
  if (!budget.public_id) {
    toast.error("Link público ainda não foi gerado para este orçamento.");
    return;
  }

  if (!autoPublish) {
    toast.error(
      "Nenhuma versão publicada disponível. Publique o orçamento para abrir o link público.",
    );
    return;
  }

  const toastId = toast.loading("Publicando orçamento...");
  const { error: updErr } = await supabase
    .from("budgets")
    .update({ status: "published" })
    .eq("id", budget.id);
  toast.dismiss(toastId);

  if (updErr) {
    toast.error("Não foi possível publicar: " + updErr.message);
    return;
  }

  onStatusChanged?.("published");
  toast.success("Orçamento publicado");
  window.open(getPublicBudgetUrl(budget.public_id), "_blank", "noopener,noreferrer");
}
