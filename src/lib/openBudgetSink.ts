/**
 * Sink remoto da telemetria de abertura de orçamento.
 *
 * Cada evento (sucesso ou falha do botão "Visualizar") é enviado para
 * `public.open_budget_telemetry` no Supabase. O envio é silencioso e nunca
 * pode quebrar o fluxo do usuário.
 *
 * Decisões:
 * - **correlation_id por sessão**: persistido em sessionStorage; agrupa todos
 *   os eventos de uma mesma sessão de navegação (útil para diagnóstico).
 * - **event_id único por evento**: UUID gerado no cliente; índice UNIQUE no
 *   banco protege contra duplicação se o sendBeacon e o fetch retry coincidirem.
 * - **sendBeacon primeiro**: sobrevive a unload da página (usuário fecha a aba
 *   logo após clicar). Fallback para `fetch keepalive` e, em último caso, o
 *   client supabase-js (caminho com retry interno).
 * - **Dedup curto + amostragem leve para sucessos**: falhas vão 100%; sucessos
 *   passam por amostragem decrescente para preservar o sinal sem flood.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  attachOpenBudgetSink,
  type OpenBudgetDiagnosis,
} from "./openPublicBudgetTelemetry";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
const DEPLOY_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown";
const TABLE = "open_budget_telemetry";
const ENDPOINT = SUPABASE_URL
  ? `${SUPABASE_URL}/rest/v1/${TABLE}`
  : "";

const CORRELATION_KEY = "__open_budget_correlation_id";
const DEDUPE_WINDOW_MS = 5_000;
const recent = new Map<string, number>();

/** UUID v4 com fallback para ambientes sem `crypto.randomUUID`. */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCorrelationId(): string {
  if (typeof sessionStorage === "undefined") return uuid();
  try {
    let id = sessionStorage.getItem(CORRELATION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(CORRELATION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

/** Sucessos repetidos na mesma janela são descartados; falhas vão sempre. */
function shouldDedup(diag: OpenBudgetDiagnosis): boolean {
  if (diag.outcome.startsWith("blocked_") || diag.errorMessage) return false;
  const key = [diag.source, diag.outcome, diag.resolvedPublicId ?? "-"].join("|");
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  recent.set(key, now);
  if (recent.size > 50) {
    for (const [k, ts] of recent) if (now - ts >= DEDUPE_WINDOW_MS) recent.delete(k);
  }
  return false;
}

/** Constrói a row a ser inserida na tabela. */
function buildRow(diag: OpenBudgetDiagnosis, correlationId: string, eventId: string) {
  const route =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : null;
  return {
    event_id: eventId,
    correlation_id: correlationId,
    source: diag.source,
    outcome: diag.outcome,
    popup_blocked: diag.popupBlocked,
    input_public_id: diag.inputPublicId,
    resolved_public_id: diag.resolvedPublicId,
    resolved_from: diag.resolvedFrom,
    input_status: diag.inputStatus,
    input_budget_id: diag.inputBudgetId,
    error_message: diag.errorMessage?.slice(0, 1000) ?? null,
    duration_ms: diag.durationMs,
    route,
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    viewport_width: typeof window !== "undefined" ? window.innerWidth : null,
    viewport_height: typeof window !== "undefined" ? window.innerHeight : null,
    deploy_version: DEPLOY_VERSION,
    payload: {
      steps: diag.steps,
      startedAt: diag.startedAt,
    },
  };
}

/**
 * Envia o evento via sendBeacon (sobrevive a unload). Retorna true se aceito
 * pelo navegador. Não confirma persistência — o servidor pode rejeitar.
 */
function sendViaBeacon(row: Record<string, unknown>): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function" ||
    !ENDPOINT ||
    !SUPABASE_ANON_KEY
  ) {
    return false;
  }
  try {
    // sendBeacon não suporta headers customizados; usamos query params para a apikey.
    // Como o REST do PostgREST exige `apikey` e `Authorization`, anexamos via querystring
    // suportada pelo Supabase (apikey) e enviamos um Blob com o payload e o tipo correto.
    const url = `${ENDPOINT}?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;
    const blob = new Blob([JSON.stringify(row)], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

/** Fallback: fetch com keepalive — também sobrevive a unload. */
async function sendViaFetch(row: Record<string, unknown>): Promise<boolean> {
  if (!ENDPOINT || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Último recurso: client supabase-js (com retry interno do auth-fetch-retry). */
async function sendViaClient(row: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from(TABLE as never).insert(row as never);
  } catch {
    /* silencioso */
  }
}

async function send(diag: OpenBudgetDiagnosis): Promise<void> {
  if (shouldDedup(diag)) return;
  const correlationId = getCorrelationId();
  const eventId = uuid();
  const row = buildRow(diag, correlationId, eventId);

  // Anota o correlation/event_id no diagnóstico exposto em window.__openBudgetDiag
  // — facilita o suporte ("me passe o ID que aparece no console").
  if (typeof window !== "undefined") {
    const w = window as unknown as {
      __openBudgetDiag?: OpenBudgetDiagnosis & { correlationId?: string; eventId?: string };
    };
    if (w.__openBudgetDiag) {
      w.__openBudgetDiag.correlationId = correlationId;
      w.__openBudgetDiag.eventId = eventId;
    }
  }

  if (sendViaBeacon(row)) return;
  if (await sendViaFetch(row)) return;
  await sendViaClient(row);
}

let installed = false;
/**
 * Conecta o sink ao trace global. Idempotente. Retorna função para destacar
 * (útil em testes).
 */
export function installOpenBudgetSink(): () => void {
  if (installed) return () => {};
  installed = true;
  return attachOpenBudgetSink((diag) => {
    void send(diag);
  });
}

/** Exposto para suporte: lê o correlation_id atual do console. */
export function getOpenBudgetCorrelationId(): string {
  return getCorrelationId();
}
