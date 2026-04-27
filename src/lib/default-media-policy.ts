/**
 * Política de mídia padrão para novos orçamentos.
 *
 * Regra de negócio:
 * - A mídia padrão herdada de templates deve conter APENAS imagens 3D.
 * - Vídeo 3D, Projeto Executivo e Fotos do projeto NÃO devem ser definidos
 *   por padrão — esses devem ser uploads manuais por orçamento, pois são
 *   sempre específicos da obra real.
 *
 * Esta camada protege o sistema caso alguém configure indevidamente
 * um template com vídeo/fotos: o conteúdo proibido é silenciosamente
 * descartado antes de ser propagado para novos orçamentos.
 *
 * Camadas de fallback (do mais alto ao mais baixo):
 *  1. media_config explícito do template selecionado pelo usuário
 *  2. media_config do primeiro template ATIVO (ordem de criação)
 *  3. HARDCODED_FALLBACK_MEDIA (snapshot da mídia padrão "Lek Ferreira")
 */

import { supabase } from "@/integrations/supabase/client";

import { logger } from "@/lib/logger";

export type MediaConfigShape = {
  video3d?: string;
  projeto3d?: string[];
  projetoExecutivo?: string[];
  fotos?: string[];
};

/** Categorias permitidas em mídia padrão (herdada via template). */
export const ALLOWED_DEFAULT_CATEGORIES = ["projeto3d"] as const;

/**
 * Snapshot da mídia padrão "Lek Ferreira" — usada como último recurso quando
 * nenhum template ativo existe ou todos têm media_config inválido/vazio.
 *
 * As URLs apontam para o bucket público `media` no Supabase Storage,
 * pasta `a799b2f101cb/3d/` (publicId do orçamento Lek). Manter sincronizado
 * com o `budget` de referência se a galeria padrão for redefinida.
 */
const FALLBACK_PUBLIC_ID = "a799b2f101cb";
const FALLBACK_3D_FILES = [
  "01-q1_aberto.png",
  "02-5.png",
  "03-q1_marcenaria_abrir.png",
  "04-dagmar-5-.png",
  "05-ewfeqf.png",
  "06-q4_marcenaria_correr.png",
  "07-variacao2_carvalho_jari_cinza_puro.png",
  "08-v4b_moka_cinza_cristal_rack_nicho.png",
  "09-v4a_moka_cinza_cristal_rack_parede.png",
  "10-5rr4.png",
  "11-f4f555.png",
  "12-d01_rack_nicho_led.png",
  "13-ERIK-ZIP-00-11-1-.png",
  "14-v1_armario_espelhado_correr.png",
  "15-v2_aberto_nichos_led.png",
] as const;

function buildHardcodedFallback(): MediaConfigShape {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const base = `${supabaseUrl}/storage/v1/object/public/media/${FALLBACK_PUBLIC_ID}/3d`;
  return {
    projeto3d: FALLBACK_3D_FILES.map((name) => `${base}/${name}`),
    projetoExecutivo: [],
    fotos: [],
  };
}

/**
 * Retorna o snapshot hard-coded da mídia padrão (Lek). Sempre disponível,
 * mesmo se o banco estiver inacessível ou os templates forem apagados.
 */
export function getHardcodedFallbackMedia(): MediaConfigShape {
  return buildHardcodedFallback();
}

/**
 * Sanitiza um media_config para uso como mídia padrão.
 * - Mantém somente arrays de URLs em categorias permitidas.
 * - Descarta video3d, projetoExecutivo e fotos (devem ser manuais).
 * - Retorna `null` se nada sobrar (nada para aplicar).
 */
export function sanitizeDefaultMedia(
  raw: MediaConfigShape | null | undefined
): MediaConfigShape | null {
  if (!raw || typeof raw !== "object") return null;

  const sanitized: MediaConfigShape = {
    projeto3d: Array.isArray(raw.projeto3d)
      ? raw.projeto3d.filter(u => typeof u === "string" && u.trim().length > 0)
      : [],
    projetoExecutivo: [],
    fotos: [],
    // video3d intencionalmente omitido (deve ser manual)
  };

  const has3d = (sanitized.projeto3d?.length ?? 0) > 0;
  if (!has3d) return null;

  return sanitized;
}

/**
 * Valida se um media_config respeita a política padrão.
 * Útil para testes e auditoria.
 */
export function isValidDefaultMedia(mc: MediaConfigShape | null | undefined): boolean {
  if (!mc) return false;
  const has3d = Array.isArray(mc.projeto3d) && mc.projeto3d.length > 0;
  const hasVideo = typeof mc.video3d === "string" && mc.video3d.trim().length > 0;
  const hasExec = Array.isArray(mc.projetoExecutivo) && mc.projetoExecutivo.length > 0;
  const hasFotos = Array.isArray(mc.fotos) && mc.fotos.length > 0;
  return has3d && !hasVideo && !hasExec && !hasFotos;
}

export type DefaultMediaSource =
  | "selected_template"
  | "first_active_template"
  | "hardcoded_fallback";

export interface ResolvedDefaultMedia {
  media: MediaConfigShape;
  source: DefaultMediaSource;
}

/**
 * Resolve a mídia padrão a aplicar em um novo orçamento, percorrendo as
 * camadas de fallback até obter um conjunto válido. NUNCA retorna null:
 * o snapshot hard-coded garante que sempre haverá galeria.
 *
 * @param explicitTemplateId  ID do template escolhido pelo usuário (opcional)
 */
export async function resolveDefaultMedia(
  explicitTemplateId?: string | null
): Promise<ResolvedDefaultMedia> {
  // 1. Template explícito (escolhido pelo usuário no formulário)
  if (explicitTemplateId) {
    try {
      const { data } = await supabase
        .from("budget_templates")
        .select("media_config")
        .eq("id", explicitTemplateId)
        .maybeSingle();
      const safe = sanitizeDefaultMedia(data?.media_config as MediaConfigShape | null);
      if (safe) return { media: safe, source: "selected_template" };
    } catch (err) {
      logger.warn("[default-media] Falha ao ler template selecionado:", err);
    }
  }

  // 2. Primeiro template ativo (ordem de criação)
  try {
    const { data } = await supabase
      .from("budget_templates")
      .select("media_config")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const safe = sanitizeDefaultMedia(data?.media_config as MediaConfigShape | null);
    if (safe) return { media: safe, source: "first_active_template" };
  } catch (err) {
    logger.warn("[default-media] Falha ao ler primeiro template ativo:", err);
  }

  // 3. Safety net final — sempre disponível
  return { media: getHardcodedFallbackMedia(), source: "hardcoded_fallback" };
}
