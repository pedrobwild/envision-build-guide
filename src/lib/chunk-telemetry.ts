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
 *
 * Estratégia de controle de volume (evitar inundar a tabela):
 *   1. **Dedup por chave composta** `(public_id, route, deploy_version,
 *      chunk_url)` em janela de 60s — o mesmo chunk falhando várias vezes
 *      em sequência conta como um único evento.
 *   2. **Dedup persistente por sessão** — a mesma chave reportada uma vez
 *      na sessão não é reenviada (a info já está no banco; basta um
 *      heartbeat para confirmar persistência).
 *   3. **Amostragem adaptativa por sessão** — se a mesma sessão já enviou
 *      muitos eventos, aplica uma taxa amostral decrescente para preservar
 *      o sinal sem floodar.
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

/** Janela de dedup em memória (rajadas curtas do mesmo erro). */
const DEDUPE_WINDOW_MS = 60_000;

/** Limites de amostragem por sessão (eventos enviados de fato). */
const SAMPLING_TIERS: Array<{ threshold: number; rate: number }> = [
  { threshold: 5, rate: 1 }, // primeiros 5 eventos: 100%
  { threshold: 20, rate: 0.5 }, // 6º ao 20º: 50%
  { threshold: 50, rate: 0.2 }, // 21º ao 50º: 20%
  { threshold: Infinity, rate: 0.05 }, // a partir do 51º: 5%
];

/** Chave usada no sessionStorage para o set persistente de dedup. */
const SESSION_DEDUPE_KEY = "__chunk_tlm_seen";
/** Chave usada no sessionStorage para o contador de envios da sessão. */
const SESSION_COUNTER_KEY = "__chunk_tlm_count";

/** Cache em memória da janela curta. Map<key, timestamp_ms>. */
const recentReports = new Map<string, number>();

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

/** Normaliza a URL do chunk removendo querystring de cache-busting (?v=, ?t=, ?retry=). */
function normalizeChunkUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin + u.pathname; // ignora search/hash
  } catch {
    return url.split("?")[0] || url;
  }
}

/**
 * Constrói a chave composta de dedup: (public_id, route, deploy_version, chunk_url).
 * Rotas com query string são reduzidas ao pathname para que `?utm=...` não
 * gere chaves diferentes para o mesmo problema.
 */
function buildDedupKey(
  publicId: string | null,
  pathname: string,
  chunkUrl: string | null,
): string {
  return [
    publicId ?? "-",
    pathname,
    DEPLOY_VERSION,
    normalizeChunkUrl(chunkUrl) ?? "-",
  ].join("|");
}

/** Lê o set persistente da sessão (chaves já reportadas nesta aba). */
function getSessionSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_DEDUPE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function persistSessionSeen(set: Set<string>) {
  try {
    // Limita o tamanho do set (LRU simples por inserção) para não estourar quota.
    const arr = Array.from(set).slice(-100);
    sessionStorage.setItem(SESSION_DEDUPE_KEY, JSON.stringify(arr));
  } catch {
    // sessionStorage indisponível (modo privado, iframe sem permissão): ignora.
  }
}

function getSessionCount(): number {
  try {
    const raw = sessionStorage.getItem(SESSION_COUNTER_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function bumpSessionCount(): number {
  const next = getSessionCount() + 1;
  try {
    sessionStorage.setItem(SESSION_COUNTER_KEY, String(next));
  } catch {
    /* noop */
  }
  return next;
}

/**
 * Decide se este evento deve ser amostrado (enviado) com base no número
 * de eventos já enviados nesta sessão. Quanto mais alto o volume, menor
 * a probabilidade — preservando o sinal sem inundar a tabela.
 */
function shouldSample(currentCount: number): boolean {
  for (const tier of SAMPLING_TIERS) {
    if (currentCount < tier.threshold) {
      if (tier.rate >= 1) return true;
      if (tier.rate <= 0) return false;
      return Math.random() < tier.rate;
    }
  }
  return false;
}

export async function reportChunkLoadError(
  payload: ChunkTelemetryPayload,
): Promise<void> {
  if (typeof window === "undefined") return;

  const pathname = window.location.pathname;
  const publicId = extractPublicIdFromPath(pathname);
  const chunkUrl =
    payload.chunkUrl ?? extractChunkUrlFromMessage(payload.errorMessage);
  const dedupKey = buildDedupKey(publicId, pathname, chunkUrl);
  const now = Date.now();

  // 1) Dedup em memória — rajadas curtas (mesmo chunk falhando várias vezes
  //    em sequência por causa de retentativa do React/Vite).
  const lastSeenAt = recentReports.get(dedupKey);
  if (lastSeenAt !== undefined && now - lastSeenAt < DEDUPE_WINDOW_MS) {
    return;
  }
  recentReports.set(dedupKey, now);
  // Limpeza preguiçosa: remove entradas antigas para evitar crescimento ilimitado.
  if (recentReports.size > 50) {
    for (const [k, ts] of recentReports) {
      if (now - ts >= DEDUPE_WINDOW_MS) recentReports.delete(k);
    }
  }

  // 2) Dedup persistente por sessão — a mesma combinação já foi registrada
  //    nesta aba; o servidor já tem o evento, não precisamos repetir.
  const seen = getSessionSeen();
  if (seen.has(dedupKey)) {
    return;
  }

  // 3) Amostragem adaptativa — preserva o sinal sem flood.
  const currentCount = getSessionCount();
  if (!shouldSample(currentCount)) {
    // Mesmo amostrado fora, marcamos como visto para não retentar imediatamente.
    seen.add(dedupKey);
    persistSessionSeen(seen);
    return;
  }

  try {
    const route = pathname + window.location.search;

    let reporterId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      reporterId = data.session?.user?.id ?? null;
    } catch {
      reporterId = null;
    }

    const { error } = await supabase.from("chunk_load_errors").insert({
      public_id: publicId,
      route,
      deploy_version: DEPLOY_VERSION,
      error_name: payload.errorName ?? null,
      error_message: payload.errorMessage?.slice(0, 1000) ?? null,
      chunk_url: normalizeChunkUrl(chunkUrl),
      user_agent: navigator.userAgent.slice(0, 500),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
      reporter_id: reporterId,
      metadata: {
        referrer: document.referrer || null,
        deviceMemory:
          (navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          null,
        connection:
          (navigator as Navigator & { connection?: { effectiveType?: string } })
            .connection?.effectiveType ?? null,
        sessionEventIndex: currentCount + 1,
        sampledFromTier:
          SAMPLING_TIERS.find((t) => currentCount < t.threshold)?.rate ?? null,
        ...payload.extraMetadata,
      },
    });

    // Só marcamos como visto/contado quando o insert foi aceito — caso
    // contrário a próxima ocorrência ainda terá chance de reportar.
    if (!error) {
      seen.add(dedupKey);
      persistSessionSeen(seen);
      bumpSessionCount();
    }
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
