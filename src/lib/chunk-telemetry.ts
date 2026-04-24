/**
 * Telemetria de falhas de carregamento de chunks (lazy imports).
 *
 * Quando um `import()` dinâmico falha — geralmente porque o cliente está
 * com uma versão antiga do app em cache enquanto o servidor já publicou
 * uma nova — registramos o evento em `public.chunk_load_errors` para
 * conseguir correlacionar com:
 *   - public_id do orçamento (quando ocorre na rota pública /o/:publicId
 *     ou /obra/:projectId/orcamento)
 *   - versão do deploy atual (injetada no build via VITE_APP_VERSION)
 *   - rota, navegador, viewport e estado de conexão
 *
 * O envio é "fire and forget" e silencioso: se a telemetria falhar,
 * não atrapalha a UX de recuperação (botão Atualizar).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ChunkTelemetryPayload {
  errorName?: string;
  errorMessage?: string;
  chunkUrl?: string | null;
  extraMetadata?: Record<string, unknown>;
}

/** Versão do build atual; preenchida em build time pelo Vite. */
const DEPLOY_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown";

/**
 * Tenta extrair um identificador público da URL atual. Cobre as duas rotas
 * públicas existentes: `/o/:publicId` e `/obra/:projectId/orcamento`.
 */
function extractPublicIdFromPath(pathname: string): string | null {
  const oMatch = pathname.match(/^\/o\/([^/?#]+)/);
  if (oMatch) return oMatch[1];
  const obraMatch = pathname.match(/^\/obra\/([^/?#]+)\/orcamento/);
  if (obraMatch) return obraMatch[1];
  return null;
}

/**
 * Tenta inferir a URL do chunk que falhou a partir da mensagem do erro.
 * Os bundlers normalmente incluem o caminho do asset entre aspas.
 */
function extractChunkUrlFromMessage(message: string | undefined): string | null {
  if (!message) return null;
  const match = message.match(/https?:\/\/[^\s'"`)]+/);
  return match ? match[0] : null;
}

let lastReportKey: string | null = null;
let lastReportAt = 0;
const DEDUPE_WINDOW_MS = 5_000;

export async function reportChunkLoadError(
  payload: ChunkTelemetryPayload
): Promise<void> {
  if (typeof window === "undefined") return;

  // Deduplicação simples para não floodar a tabela quando o mesmo erro
  // dispara múltiplas vezes em sequência (ex.: várias retentativas do React).
  const key = `${payload.errorName ?? ""}::${payload.errorMessage ?? ""}`;
  const now = Date.now();
  if (key === lastReportKey && now - lastReportAt < DEDUPE_WINDOW_MS) {
    return;
  }
  lastReportKey = key;
  lastReportAt = now;

  try {
    const route = window.location.pathname + window.location.search;
    const publicId = extractPublicIdFromPath(window.location.pathname);
    const chunkUrl =
      payload.chunkUrl ?? extractChunkUrlFromMessage(payload.errorMessage);

    let reporterId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      reporterId = data.session?.user?.id ?? null;
    } catch {
      reporterId = null;
    }

    await supabase.from("chunk_load_errors").insert({
      public_id: publicId,
      route,
      deploy_version: DEPLOY_VERSION,
      error_name: payload.errorName ?? null,
      error_message: payload.errorMessage?.slice(0, 1000) ?? null,
      chunk_url: chunkUrl,
      user_agent: navigator.userAgent.slice(0, 500),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
      reporter_id: reporterId,
      metadata: {
        referrer: document.referrer || null,
        deviceMemory: (navigator as Navigator & { deviceMemory?: number })
          .deviceMemory ?? null,
        connection:
          (navigator as Navigator & { connection?: { effectiveType?: string } })
            .connection?.effectiveType ?? null,
        ...payload.extraMetadata,
      },
    });
  } catch {
    // Silencioso por design — telemetria nunca pode quebrar a UX.
  }
}

/** Heurística para identificar se um Error é falha de carregamento de chunk. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message ?? "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Unable to preload CSS") ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Registra listeners globais para capturar falhas de chunk que escapam
 * dos error boundaries (ex.: dynamic imports disparados fora do React).
 */
let globalListenersInstalled = false;
export function installChunkErrorTelemetry() {
  if (globalListenersInstalled || typeof window === "undefined") return;
  globalListenersInstalled = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (isChunkLoadError(reason)) {
      void reportChunkLoadError({
        errorName: reason.name,
        errorMessage: reason.message,
        extraMetadata: { source: "unhandledrejection" },
      });
    }
  });

  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error)) {
      void reportChunkLoadError({
        errorName: event.error?.name,
        errorMessage: event.error?.message ?? event.message,
        chunkUrl: event.filename || null,
        extraMetadata: { source: "window.error" },
      });
    }
  });
}
