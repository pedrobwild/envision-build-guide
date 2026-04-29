/**
 * Auth session recovery — após uma falha definitiva no refresh do
 * token (ver `auth-fetch-retry`), tenta recuperar silenciosamente a
 * sessão quando a conectividade voltar, sem precisar de reload.
 *
 * Estratégia:
 *  1. Quando o retry de fetch sinaliza uma falha "final" ou
 *     "offline-timeout", marcamos `recoveryNeeded = true`.
 *  2. No evento `online` do navegador (ou após pequeno debounce),
 *     chamamos `supabase.auth.refreshSession()`. Se houver sessão
 *     persistida no storage, o SDK reemite `TOKEN_REFRESHED` e o
 *     `useAuth.onAuthStateChange` atualiza tudo naturalmente.
 *  3. Em caso de sucesso, fechamos o toast de "Sem conexão com o
 *     servidor" e mostramos um "Conexão restaurada".
 *  4. Se mesmo assim falhar (refresh_token expirado de verdade),
 *     deixamos o estado como está e o usuário pode usar o botão
 *     "Tentar novamente" (que recarrega a página) já existente.
 *
 * Idempotente: chamar `installAuthSessionRecovery()` mais de uma vez
 * é seguro.
 */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { subscribeAuthRetryState, type AuthRetryState } from "@/lib/auth-fetch-retry";

const TOAST_ID_RECOVERED = "auth-session-recovered";
const TOAST_ID_FAILED = "auth-fetch-failed"; // mesmo id do retry, p/ poder fechar
const RECOVERY_DEBOUNCE_MS = 500;

let installed = false;
let recoveryNeeded = false;
let recovering = false;
let lastState: AuthRetryState = {
  reconnecting: false,
  attempt: 0,
  maxAttempts: 0,
  reason: null,
};

async function attemptRecovery(triggerLabel: string) {
  if (recovering) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  recovering = true;
  try {
    // refreshSession() valida o refresh_token do storage e, em caso de
    // sucesso, dispara TOKEN_REFRESHED no onAuthStateChange (consumido
    // pelo useAuth), mantendo o usuário logado sem reload.
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn("[auth-session-recovery] refresh failed", { triggerLabel, error: error.message });
      return;
    }
    if (data?.session) {
      recoveryNeeded = false;
      toast.dismiss(TOAST_ID_FAILED);
      toast.success("Conexão restaurada", {
        id: TOAST_ID_RECOVERED,
        description: "Sua sessão foi recuperada automaticamente.",
        duration: 3000,
      });
      console.info("[auth-session-recovery] session recovered", { triggerLabel });
    }
  } catch (err) {
    console.warn("[auth-session-recovery] unexpected error", err);
  } finally {
    recovering = false;
  }
}

export function installAuthSessionRecovery() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Observa o ciclo do retry: quando termina (reconnecting passa de
  // true→false) sem que o usuário tenha sido redirecionado, marcamos
  // que pode haver uma sessão a recuperar.
  subscribeAuthRetryState((state) => {
    const justFinished = lastState.reconnecting && !state.reconnecting;
    lastState = state;
    if (justFinished) {
      // Pequeno debounce para deixar o fetch do retry resolver o toast
      // de falha definitiva antes de tentarmos a recuperação.
      window.setTimeout(() => {
        // Se o ciclo terminou em sucesso, o próprio fetch já entregou
        // a resposta — nada a fazer. Se terminou em erro, o toast
        // "Sem conexão com o servidor" estará visível e tentamos.
        if (document.querySelector(`[data-sonner-toast][data-id="${TOAST_ID_FAILED}"]`)) {
          recoveryNeeded = true;
          attemptRecovery("retry-finished-with-error");
        }
      }, RECOVERY_DEBOUNCE_MS);
    }
  });

  // Sempre que voltar a ficar online, se houver pendência, tenta.
  window.addEventListener("online", () => {
    if (recoveryNeeded) {
      window.setTimeout(() => attemptRecovery("online-event"), RECOVERY_DEBOUNCE_MS);
    }
  });

  // Quando a aba volta a ficar visível (ex.: usuário acordou o
  // celular), também é uma boa janela para tentar recuperar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && recoveryNeeded) {
      attemptRecovery("visibility-visible");
    }
  });
}

/**
 * Permite forçar a recuperação manualmente — útil em botões de
 * "Tentar novamente" que queremos evitar reload.
 */
export function triggerAuthSessionRecovery() {
  recoveryNeeded = true;
  return attemptRecovery("manual");
}
