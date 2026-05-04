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

/**
 * Abre uma janela "stub" SINCRONAMENTE dentro do gesto do usuário para evitar
 * o popup blocker do Chrome/Safari quando precisamos resolver async (RPC, query)
 * antes de saber a URL final. Retorna a janela (ou null se já bloqueada) e um
 * helper para apontá-la depois ou fechá-la em caso de erro.
 */
function openStubWindow() {
  const win = typeof window !== "undefined"
    ? window.open("about:blank", "_blank", "noopener,noreferrer")
    : null;
  return {
    win,
    navigate(url: string) {
      if (win && !win.closed) {
        try { win.location.href = url; return; } catch { /* fallthrough */ }
      }
      // Stub bloqueado ou fechado: tenta abrir direto (pode também ser bloqueado,
      // mas neste ponto já passamos do gesto — é o melhor que dá).
      window.open(url, "_blank", "noopener,noreferrer");
    },
    close() {
      if (win && !win.closed) { try { win.close(); } catch { /* noop */ } }
    },
  };
}

export async function openPublicBudget(
  budget: BudgetRefForPublicOpen,
  opts: OpenPublicBudgetOptions = {},
): Promise<void> {
  const { autoPublish = true, onStatusChanged } = opts;

  // 1) Já publicado: abre direto (síncrono, sem risco de popup blocker).
  if (budget.public_id && PUBLISHABLE.has(budget.status ?? "")) {
    window.open(getPublicBudgetUrl(budget.public_id), "_blank", "noopener,noreferrer");
    return;
  }

  // Para os caminhos async, abre stub agora (dentro do gesto) e navega depois.
  const stub = openStubWindow();

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
    stub.close();
    toast.error("Erro ao localizar versão publicada: " + pubErr.message);
    return;
  }

  const fallback = published?.[0];
  if (fallback?.public_id) {
    stub.navigate(getPublicBudgetUrl(fallback.public_id));
    return;
  }

  // 3) Nada publicado: publica este orçamento (se autorizado) e abre.
  if (!budget.public_id) {
    stub.close();
    toast.error("Link público ainda não foi gerado para este orçamento.");
    return;
  }

  if (!autoPublish) {
    stub.close();
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
    stub.close();
    toast.error("Não foi possível publicar: " + updErr.message);
    return;
  }

  onStatusChanged?.("published");
  toast.success("Orçamento publicado");
  stub.navigate(getPublicBudgetUrl(budget.public_id));
}

/**
 * Versão simplificada para chamadores que só têm o `public_id` em mãos
 * (cards de kanban, listas, header do editor). Resolve para a versão publicada
 * mais recente do mesmo grupo via RPC `resolve_published_public_id` antes de
 * abrir — assim o link nunca cai em "Página não encontrada" quando o orçamento
 * apontado é um draft.
 */
/**
 * Fallback adicional: localiza a versão "vencedora" (publicada mais recente do
 * mesmo version_group_id) consultando direto a tabela `budgets`. Usado quando a
 * RPC `resolve_published_public_id` retorna NULL ou devolve o próprio public_id
 * que já sabemos ser inválido para anônimos (draft).
 *
 * RLS: budgets tem leitura pública apenas em status published/minuta — então
 * essa query devolve só linhas que o anônimo conseguiria abrir, não vaza draft.
 */
async function findWinningPublishedPublicId(
  sourcePublicId: string,
): Promise<string | null> {
  // 1) Descobre o version_group_id do card clicado (pode ser draft).
  const { data: src } = await supabase
    .from("budgets")
    .select("id, version_group_id")
    .eq("public_id", sourcePublicId)
    .maybeSingle();

  const groupId = src?.version_group_id ?? src?.id;
  if (!groupId) return null;

  // 2) Procura a versão publicada mais recente do mesmo grupo.
  const { data: winner } = await supabase
    .from("budgets")
    .select("public_id, is_published_version, version_number, created_at")
    .or(`version_group_id.eq.${groupId},id.eq.${groupId}`)
    .in("status", ["published", "minuta_solicitada"])
    .not("public_id", "is", null)
    .order("is_published_version", { ascending: false, nullsFirst: false })
    .order("version_number", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return winner?.public_id ?? null;
}

export async function openPublicBudgetByPublicId(publicId: string): Promise<void> {
  if (!publicId) {
    toast.error("Link público ainda não foi gerado para este orçamento.");
    return;
  }
  // Abre stub SINCRONAMENTE no gesto do usuário para escapar do popup blocker.
  const stub = openStubWindow();
  try {
    // Camada 1: RPC oficial (security definer, mesmo grupo).
    const { data: resolved, error } = await supabase.rpc(
      "resolve_published_public_id",
      { p_public_id: publicId },
    );
    let target =
      !error && typeof resolved === "string" && resolved ? resolved : null;

    // Camada 2: fallback no cliente — se a RPC não resolveu, tenta achar a
    // versão publicada vencedora do grupo direto na tabela. Isso cobre casos
    // em que o card aponta para um draft órfão ou a RPC ficou desatualizada.
    if (!target) {
      target = await findWinningPublishedPublicId(publicId);
    }

    // Camada 3: último recurso — abre o public_id original. Pode dar 404, mas
    // é melhor que travar a navegação dentro do gesto do usuário.
    if (!target) {
      toast.error(
        "Nenhuma versão publicada disponível para este orçamento. Publique antes de compartilhar.",
      );
      stub.close();
      return;
    }

    stub.navigate(getPublicBudgetUrl(target));
  } catch {
    stub.navigate(getPublicBudgetUrl(publicId));
  }
}
