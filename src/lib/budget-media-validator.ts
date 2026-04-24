/**
 * Validador de URLs de mídia do orçamento.
 *
 * Objetivo: dado um `media_config` (capa de vídeo 3D + miniaturas de
 * Projeto 3D / Projeto Executivo / Fotos), verificar se cada URL pública
 * realmente responde com sucesso no Supabase Storage. Retorna um relatório
 * detalhado com os itens que falharam, agrupados por categoria.
 *
 * Usado por:
 *  - Página de Diagnóstico do Orçamento (botão "Validar mídias")
 *  - Suíte de testes (`budget-media-validator.test.ts`) que cobre a lógica
 *    de classificação e o agregador de falhas com `fetch` mockado.
 */
import type { DynamicBudgetMedia } from "@/hooks/useBudgetMedia";

export type MediaCategory = "video3d" | "projeto3d" | "projetoExecutivo" | "fotos";

export interface MediaUrlCheck {
  url: string;
  category: MediaCategory;
  /** "cover" para a primeira imagem da categoria (capa); "thumb" para as demais. */
  role: "cover" | "thumb" | "video";
  ok: boolean;
  status?: number;
  error?: string;
}

export interface MediaValidationReport {
  totalChecked: number;
  totalFailed: number;
  byCategory: Record<MediaCategory, { checked: number; failed: number }>;
  failures: MediaUrlCheck[];
  checks: MediaUrlCheck[];
  generatedAt: string;
}

/** Extrai pares (url, category, role) a partir de um media_config. */
export function collectMediaUrls(
  media: Partial<DynamicBudgetMedia> | null | undefined
): Array<Pick<MediaUrlCheck, "url" | "category" | "role">> {
  const out: Array<Pick<MediaUrlCheck, "url" | "category" | "role">> = [];
  if (!media) return out;

  if (media.video3d && media.video3d.trim().length > 0) {
    out.push({ url: media.video3d, category: "video3d", role: "video" });
  }

  const pushList = (list: string[] | undefined, category: MediaCategory) => {
    if (!Array.isArray(list)) return;
    list.forEach((url, idx) => {
      if (typeof url !== "string" || url.length === 0) return;
      out.push({ url, category, role: idx === 0 ? "cover" : "thumb" });
    });
  };

  pushList(media.projeto3d, "projeto3d");
  pushList(media.projetoExecutivo, "projetoExecutivo");
  pushList(media.fotos, "fotos");

  return out;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Faz HEAD em uma URL e considera ok = response.ok.
 * Se o servidor recusar HEAD (alguns CDNs), tenta GET com Range: bytes=0-0.
 */
export async function checkMediaUrl(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: FetchLike } = {}
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;

  const tryRequest = async (init: RequestInit): Promise<{ ok: boolean; status?: number; error?: string }> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
      return { ok: res.ok, status: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    } finally {
      clearTimeout(t);
    }
  };

  const head = await tryRequest({ method: "HEAD" });
  if (head.ok) return head;
  // Alguns provedores não suportam HEAD; tentamos um GET parcial.
  if (head.status === 405 || head.status === 403 || head.status === undefined) {
    const get = await tryRequest({ method: "GET", headers: { Range: "bytes=0-0" } });
    return get;
  }
  return head;
}

/**
 * Valida todas as URLs do `media_config` e devolve um relatório com falhas
 * detalhadas. Em caso de relatório vazio, `totalChecked = 0`.
 */
export async function validateBudgetMedia(
  media: Partial<DynamicBudgetMedia> | null | undefined,
  opts: { timeoutMs?: number; concurrency?: number; fetchImpl?: FetchLike } = {}
): Promise<MediaValidationReport> {
  const items = collectMediaUrls(media);
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const checks: MediaUrlCheck[] = [];

  // Pool simples de concorrência limitada para não saturar redes lentas.
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      const result = await checkMediaUrl(item.url, {
        timeoutMs: opts.timeoutMs,
        fetchImpl: opts.fetchImpl,
      });
      checks.push({ ...item, ...result });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

  const byCategory: MediaValidationReport["byCategory"] = {
    video3d: { checked: 0, failed: 0 },
    projeto3d: { checked: 0, failed: 0 },
    projetoExecutivo: { checked: 0, failed: 0 },
    fotos: { checked: 0, failed: 0 },
  };
  for (const c of checks) {
    byCategory[c.category].checked++;
    if (!c.ok) byCategory[c.category].failed++;
  }

  const failures = checks.filter((c) => !c.ok);
  return {
    totalChecked: checks.length,
    totalFailed: failures.length,
    byCategory,
    failures,
    checks,
    generatedAt: new Date().toISOString(),
  };
}
