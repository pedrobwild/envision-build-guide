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
 */

export type MediaConfigShape = {
  video3d?: string;
  projeto3d?: string[];
  projetoExecutivo?: string[];
  fotos?: string[];
};

/** Categorias permitidas em mídia padrão (herdada via template). */
export const ALLOWED_DEFAULT_CATEGORIES = ["projeto3d"] as const;

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
