/**
 * Abertura segura do orçamento público a partir do admin.
 *
 * Garante que o link aberto (botão "Visualizar") sempre aponte para uma
 * versão acessível por anônimos — `status IN ('published','minuta_solicitada')`
 * — evitando "Página não encontrada" quando o orçamento atual está em
 * draft mas existe outra versão publicada no mesmo grupo.
 *
 * Telemetria: cada decisão é registrada via OpenBudgetTrace e o diagnóstico
 * final é exposto em `window.__openBudgetDiag` + console (logger). Em falhas,
 * o toast inclui um botão "Ver detalhes" que imprime o diagnóstico completo.
 */
import { supabase } from "@/integrations/supabase/client";
import { getPublicBudgetUrl } from "./getPublicUrl";
import { toast } from "sonner";
import { OpenBudgetTrace, type OpenBudgetDiagnosis } from "./openPublicBudgetTelemetry";
import { getOpenMode, setOpenMode, type OpenMode } from "./openMode";

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
 * Mostra um toast de erro com botão "Ver detalhes" que imprime o diagnóstico
 * completo no console — sem usar alert() nativo (anti-padrão UX).
 */
function showDiagnosisToast(message: string, diag: OpenBudgetDiagnosis) {
  // ID curto (8 chars) para exibir; ID completo fica disponível para copiar.
  const shortId = diag.correlationId.slice(0, 8);
  toast.error(message, {
    duration: 10000,
    description: `ID de rastreamento: ${shortId} · clique em "Copiar ID" para reportar ao suporte.`,
    action: {
      label: "Copiar ID",
      onClick: () => {
        const payload = diag.correlationId;
        const fallback = () => {
          // eslint-disable-next-line no-console
          console.log("[openPublicBudget] correlationId:", payload);
          toast.message("ID copiado no console (clipboard indisponível).");
        };
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(payload).then(
            () => toast.success(`ID ${shortId} copiado.`),
            fallback,
          );
        } else {
          fallback();
        }
        // Sempre imprime o diagnóstico completo no console para debug local.
        // eslint-disable-next-line no-console
        console.group(`[openPublicBudget] diagnóstico ${shortId}`);
        // eslint-disable-next-line no-console
        console.log("correlationId:", diag.correlationId);
        // eslint-disable-next-line no-console
        console.log("sessionId:", diag.sessionId);
        // eslint-disable-next-line no-console
        console.table(diag.steps);
        // eslint-disable-next-line no-console
        console.log("Diagnóstico completo:", diag);
        // eslint-disable-next-line no-console
        console.log("Disponível em window.__openBudgetDiag");
        // eslint-disable-next-line no-console
        console.groupEnd();
      },
    },
  });
}

/**
 * Toast informando que o popup foi bloqueado e oferecendo desligar permanentemente
 * o modo "nova aba" para este usuário (escreve em localStorage via setOpenMode).
 */
function notifyPopupBlocked() {
  toast.warning("O navegador bloqueou a nova aba — abrimos na mesma aba.", {
    duration: 7000,
    action: {
      label: "Sempre na mesma aba",
      onClick: () => {
        setOpenMode("same_tab");
        toast.success("Preferência salva: orçamentos abrirão na mesma aba.");
      },
    },
  });
}

/**
 * Abre uma URL respeitando a preferência do usuário (`OpenMode`).
 *
 * - `same_tab`: navega na própria aba (`location.assign`) — sem stub, sem popup.
 * - `new_tab`:  abre nova aba; se bloqueado, navega na mesma aba como fallback
 *               e avisa o usuário (toast com opção de mudar a preferência).
 * - `auto`:     idêntico a `new_tab` mas é o default; comportamento de fallback
 *               já cobre o caso de bloqueio.
 *
 * Quando há trabalho assíncrono (resolução RPC etc.) e o modo é "nova aba",
 * abrimos um stub `about:blank` SINCRONAMENTE dentro do gesto do usuário para
 * driblar o popup blocker, e navegamos depois.
 */
function openWithMode(trace: OpenBudgetTrace, mode: OpenMode = getOpenMode()) {
  trace.step("open_mode", { mode });

  if (mode === "same_tab") {
    return {
      mode,
      navigate(url: string) {
        trace.step("same_tab_navigate", { url });
        if (typeof window !== "undefined") window.location.assign(url);
      },
      close() { /* noop */ },
    };
  }

  // new_tab / auto: abre stub agora (dentro do gesto)
  const win = typeof window !== "undefined"
    ? window.open("about:blank", "_blank", "noopener,noreferrer")
    : null;
  trace.setPopupBlocked(!win);

  return {
    mode,
    navigate(url: string) {
      if (win && !win.closed) {
        try { win.location.href = url; trace.step("stub_navigated", { url }); return; } catch { /* fallthrough */ }
      }
      // Stub indisponível: tenta nova aba uma vez
      trace.step("stub_unavailable_retry_open", { url });
      const retry = typeof window !== "undefined"
        ? window.open(url, "_blank", "noopener,noreferrer")
        : null;
      if (retry) return;
      // Bloqueado: fallback para mesma aba + avisa o usuário
      trace.step("popup_blocked_fallback_same_tab", { url });
      notifyPopupBlocked();
      if (typeof window !== "undefined") window.location.assign(url);
    },
    close() {
      if (win && !win.closed) { try { win.close(); trace.step("stub_closed"); } catch { /* noop */ } }
    },
  };
}

// Backwards-compat: nome antigo continua existindo (usado em código pré-refator).
function openStubWindow(trace: OpenBudgetTrace) {
  return openWithMode(trace);
}

export async function openPublicBudget(
  budget: BudgetRefForPublicOpen,
  opts: OpenPublicBudgetOptions = {},
): Promise<void> {
  const { autoPublish = true, onStatusChanged } = opts;
  const trace = new OpenBudgetTrace("by_budget_ref", budget.public_id, budget.id, budget.status);
  trace.step("input", { budget_id: budget.id, status: budget.status, version_group_id: budget.version_group_id ?? null });

  // 1) Já publicado: abre respeitando o modo do usuário (síncrono).
  if (budget.public_id && PUBLISHABLE.has(budget.status ?? "")) {
    const opener = openWithMode(trace);
    opener.navigate(getPublicBudgetUrl(budget.public_id));
    trace.setResolved(budget.public_id, "direct");
    trace.commit("opened_direct");
    return;
  }

  // Para os caminhos async, abre stub agora (dentro do gesto) e navega depois.
  const stub = openStubWindow(trace);

  // 2) Procura outra versão publicada no mesmo grupo.
  const groupId = budget.version_group_id ?? budget.id;
  trace.step("fallback_query", { groupId });
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
    trace.setError(pubErr.message);
    const diag = trace.commit("blocked_rpc_error");
    showDiagnosisToast("Erro ao localizar versão publicada: " + pubErr.message, diag);
    return;
  }

  const fallback = published?.[0];
  if (fallback?.public_id) {
    stub.navigate(getPublicBudgetUrl(fallback.public_id));
    trace.setResolved(fallback.public_id, "fallback");
    trace.commit("opened_via_fallback");
    return;
  }

  // 3) Nada publicado: publica este orçamento (se autorizado) e abre.
  if (!budget.public_id) {
    stub.close();
    const diag = trace.commit("blocked_no_public_id");
    showDiagnosisToast("Link público ainda não foi gerado para este orçamento.", diag);
    return;
  }

  if (!autoPublish) {
    stub.close();
    const diag = trace.commit("blocked_no_published");
    showDiagnosisToast(
      "Nenhuma versão publicada disponível. Publique o orçamento para abrir o link público.",
      diag,
    );
    return;
  }

  trace.step("auto_publish_attempt", { budget_id: budget.id });
  const toastId = toast.loading("Publicando orçamento...");
  const { error: updErr } = await supabase
    .from("budgets")
    .update({ status: "published" })
    .eq("id", budget.id);
  toast.dismiss(toastId);

  if (updErr) {
    stub.close();
    trace.setError(updErr.message);
    const diag = trace.commit("blocked_publish_error");
    showDiagnosisToast("Não foi possível publicar: " + updErr.message, diag);
    return;
  }

  onStatusChanged?.("published");
  toast.success("Orçamento publicado");
  stub.navigate(getPublicBudgetUrl(budget.public_id));
  trace.setResolved(budget.public_id, "direct");
  trace.commit("opened_after_publish");
}

/**
 * Fallback adicional: localiza a versão "vencedora" (publicada mais recente do
 * mesmo version_group_id) consultando direto a tabela `budgets`. Usado quando a
 * RPC `resolve_published_public_id` retorna NULL ou devolve o próprio public_id
 * que já sabemos ser inválido para anônimos (draft).
 */
async function findWinningPublishedPublicId(
  sourcePublicId: string,
  trace: OpenBudgetTrace,
): Promise<string | null> {
  trace.step("client_fallback_lookup", { sourcePublicId });
  const { data: src, error: srcErr } = await supabase
    .from("budgets")
    .select("id, version_group_id")
    .eq("public_id", sourcePublicId)
    .maybeSingle();

  if (srcErr) trace.step("client_fallback_src_error", { message: srcErr.message });

  const groupId = src?.version_group_id ?? src?.id;
  if (!groupId) {
    trace.step("client_fallback_no_group", {});
    return null;
  }
  trace.step("client_fallback_group_found", { groupId });

  const { data: winner, error: winErr } = await supabase
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

  if (winErr) trace.step("client_fallback_winner_error", { message: winErr.message });
  trace.step("client_fallback_winner", { public_id: winner?.public_id ?? null });

  return winner?.public_id ?? null;
}

export async function openPublicBudgetByPublicId(publicId: string): Promise<void> {
  const trace = new OpenBudgetTrace("by_public_id", publicId || null);

  if (!publicId) {
    const diag = trace.commit("blocked_no_public_id");
    showDiagnosisToast("Link público ainda não foi gerado para este orçamento.", diag);
    return;
  }

  const stub = openStubWindow(trace);
  try {
    // Camada 1: RPC oficial (security definer, mesmo grupo).
    trace.step("rpc_call", { p_public_id: publicId });
    const { data: resolved, error } = await supabase.rpc(
      "resolve_published_public_id",
      { p_public_id: publicId },
    );
    if (error) trace.step("rpc_error", { message: error.message });
    let target =
      !error && typeof resolved === "string" && resolved ? resolved : null;
    trace.step("rpc_result", { resolved: target });

    // Camada 2: fallback no cliente.
    if (!target) {
      target = await findWinningPublishedPublicId(publicId, trace);
      if (target) trace.setResolved(target, "fallback");
    } else {
      trace.setResolved(target, "rpc");
    }

    // Camada 3: nada publicado — não navega para draft.
    if (!target) {
      stub.close();
      const diag = trace.commit("blocked_no_published");
      showDiagnosisToast(
        "Nenhuma versão publicada disponível para este orçamento. Publique antes de compartilhar.",
        diag,
      );
      return;
    }

    stub.navigate(getPublicBudgetUrl(target));
    trace.commit(target === resolved ? "opened_via_rpc" : "opened_via_fallback");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    trace.setError(msg);
    stub.navigate(getPublicBudgetUrl(publicId));
    trace.setResolved(publicId, "original");
    const diag = trace.commit("opened_original");
    // Aviso silencioso — não bloqueia, mas registra no console.
    showDiagnosisToast(
      "Abrimos o link original, mas houve um erro ao validar a versão publicada.",
      diag,
    );
  }
}
