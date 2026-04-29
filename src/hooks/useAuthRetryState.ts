/**
 * Hook React para observar o estado de "reconectando" do retry de auth
 * (refresh_token do Supabase). Use para desabilitar botões e exibir um
 * indicador inline em formulários que dependem de sessão válida.
 *
 * Exemplo:
 *   const { reconnecting, attempt, maxAttempts, reason } = useAuthRetryState();
 *   <Button disabled={loading || reconnecting}>
 *     {reconnecting ? `Reconectando… (${attempt}/${maxAttempts})` : "Entrar"}
 *   </Button>
 */
import { useSyncExternalStore } from "react";
import {
  getAuthRetryState,
  subscribeAuthRetryState,
  type AuthRetryState,
} from "@/lib/auth-fetch-retry";

export function useAuthRetryState(): AuthRetryState {
  return useSyncExternalStore(
    subscribeAuthRetryState,
    getAuthRetryState,
    getAuthRetryState, // SSR — devolve mesmo snapshot
  );
}
