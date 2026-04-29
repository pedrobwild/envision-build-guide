/**
 * Auth fetch retry — envolve o fetch global para tentar novamente requisições
 * de refresh_token do Supabase Auth quando ocorre "Failed to fetch" (rede
 * instável, sleep do dispositivo, perda momentânea de conectividade).
 *
 * Comportamento:
 *  - Faz até MAX_RETRIES tentativas com backoff exponencial (1s, 2s, 4s).
 *  - Só retenta em erros de rede (TypeError "Failed to fetch") — não em 4xx/5xx.
 *  - Aplica-se apenas a chamadas para `/auth/v1/token` (refresh/login),
 *    para não interferir em queries normais.
 *  - Mostra um toast de aviso ao usuário em caso de retry e outro em caso
 *    de falha final, com ação "Tentar novamente" que recarrega a página.
 *  - Idempotente: chamar `installAuthFetchRetry()` mais de uma vez é seguro.
 */
import { toast } from "sonner";

/**
 * Configuração de retry — pode ser ajustada via variáveis de ambiente Vite:
 *   VITE_AUTH_RETRY_MAX        → número máximo de tentativas (default 3)
 *   VITE_AUTH_RETRY_BASE_MS    → delay base em ms (default 1000)
 *   VITE_AUTH_RETRY_FACTOR     → fator do backoff exponencial (default 2)
 *   VITE_AUTH_RETRY_MAX_MS     → teto do delay por tentativa em ms (default 30000)
 *
 * Backoff: delay(attempt) = min(BASE * FACTOR^attempt, MAX_MS)
 * Os valores podem ser sobrescritos em runtime via `setAuthRetryConfig({...})`
 * (útil para testes ou para ajustar dinamicamente conforme telemetria).
 */
const env = (import.meta as any).env ?? {};

function num(value: unknown, fallback: number, min = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export const AUTH_RETRY_CONFIG = {
  maxRetries: num(env.VITE_AUTH_RETRY_MAX, 3, 0),
  baseDelayMs: num(env.VITE_AUTH_RETRY_BASE_MS, 1000, 0),
  backoffFactor: num(env.VITE_AUTH_RETRY_FACTOR, 2, 1),
  maxDelayMs: num(env.VITE_AUTH_RETRY_MAX_MS, 30_000, 0),
};

export function setAuthRetryConfig(patch: Partial<typeof AUTH_RETRY_CONFIG>) {
  Object.assign(AUTH_RETRY_CONFIG, patch);
}

const TOAST_ID_RETRYING = "auth-fetch-retrying";
const TOAST_ID_FAILED = "auth-fetch-failed";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isAuthTokenRequest(input: RequestInfo | URL): boolean {
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    return url.includes("/auth/v1/token");
  } catch {
    return false;
  }
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    typeof err.message === "string" &&
    /failed to fetch|networkerror|load failed/i.test(err.message)
  );
}

let installed = false;

export function installAuthFetchRetry() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isAuthTokenRequest(input)) {
      return originalFetch(input, init);
    }

    let lastError: unknown;
    const { maxRetries, baseDelayMs, backoffFactor, maxDelayMs } = AUTH_RETRY_CONFIG;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await originalFetch(input, init);
        // Sucesso (mesmo que 4xx/5xx) — limpa toast de retry se existir
        if (attempt > 0) {
          toast.dismiss(TOAST_ID_RETRYING);
          toast.dismiss(TOAST_ID_FAILED);
        }
        return res;
      } catch (err) {
        lastError = err;
        if (!isNetworkError(err) || attempt === maxRetries) break;

        const delay = Math.min(
          baseDelayMs * Math.pow(backoffFactor, attempt),
          maxDelayMs,
        );
        toast.warning("Conexão instável", {
          id: TOAST_ID_RETRYING,
          description: `Tentando reconectar… (${attempt + 1}/${maxRetries})`,
          duration: delay + 500,
        });
        await sleep(delay);
      }
    }

    // Falha definitiva — avisa o usuário
    toast.dismiss(TOAST_ID_RETRYING);
    toast.error("Sem conexão com o servidor", {
      id: TOAST_ID_FAILED,
      description:
        "Não foi possível renovar sua sessão. Verifique sua internet.",
      duration: Infinity,
      action: {
        label: "Tentar novamente",
        onClick: () => window.location.reload(),
      },
    });

    throw lastError;
  };
}
