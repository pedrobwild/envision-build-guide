/**
 * Lógica pura de replicação de mídia padrão para orçamentos.
 *
 * Regra invariante (NÃO QUEBRAR):
 *  - Orçamentos cujo `media_config` já contém qualquer mídia real
 *    (vídeo 3D, fotos, projeto executivo OU array projeto3d não-vazio)
 *    são considerados "upload manual" e DEVEM ser pulados pela replicação.
 *  - A replicação só pode tocar em orçamentos sem mídia (vazio/null).
 *
 * Esta função é puramente síncrona e determinística para permitir
 * testes automatizados que garantem que a integridade dos uploads
 * manuais nunca é violada — sem necessidade de banco ou Storage.
 */
import {
  sanitizeDefaultMedia,
  type MediaConfigShape,
} from "@/lib/default-media-policy";

export type ReplicationDecision =
  | { action: "skip"; reason: "manual_media_present" }
  | { action: "skip"; reason: "no_default_available" }
  | { action: "apply"; nextConfig: MediaConfigShape };

export interface BudgetForReplication {
  id: string;
  media_config: MediaConfigShape | null | undefined;
}

/**
 * Detecta se um media_config contém mídia "real" carregada manualmente.
 * Considera manual qualquer um destes:
 *  - video3d com URL não-vazia
 *  - projeto3d com pelo menos 1 URL
 *  - projetoExecutivo com pelo menos 1 URL
 *  - fotos com pelo menos 1 URL
 */
export function hasManualMedia(mc: MediaConfigShape | null | undefined): boolean {
  if (!mc || typeof mc !== "object") return false;
  const hasVideo = typeof mc.video3d === "string" && mc.video3d.trim().length > 0;
  const has3d = Array.isArray(mc.projeto3d) && mc.projeto3d.length > 0;
  const hasExec =
    Array.isArray(mc.projetoExecutivo) && mc.projetoExecutivo.length > 0;
  const hasFotos = Array.isArray(mc.fotos) && mc.fotos.length > 0;
  return hasVideo || has3d || hasExec || hasFotos;
}

/**
 * Decide o que fazer com um orçamento durante a replicação de mídia padrão.
 * Pura: sem efeitos colaterais, sem I/O.
 */
export function decideReplicationFor(
  budget: BudgetForReplication,
  defaultMedia: MediaConfigShape | null | undefined
): ReplicationDecision {
  // 1. Invariante crítico: NUNCA tocar em orçamentos com upload manual.
  if (hasManualMedia(budget.media_config)) {
    return { action: "skip", reason: "manual_media_present" };
  }

  // 2. Sem mídia padrão sanitizada disponível → não há o que aplicar.
  const safe = sanitizeDefaultMedia(defaultMedia ?? null);
  if (!safe) {
    return { action: "skip", reason: "no_default_available" };
  }

  // 3. OK aplicar.
  return { action: "apply", nextConfig: safe };
}

export interface ReplicationPlan {
  applied: Array<{ id: string; nextConfig: MediaConfigShape }>;
  skipped: Array<{ id: string; reason: "manual_media_present" | "no_default_available" }>;
}

/**
 * Constrói o plano de replicação para uma lista de orçamentos sem
 * efetivamente tocar em nada. Útil para auditoria E testes.
 */
export function planReplication(
  budgets: BudgetForReplication[],
  defaultMedia: MediaConfigShape | null | undefined
): ReplicationPlan {
  const plan: ReplicationPlan = { applied: [], skipped: [] };
  for (const b of budgets) {
    const decision = decideReplicationFor(b, defaultMedia);
    if (decision.action === "apply") {
      plan.applied.push({ id: b.id, nextConfig: decision.nextConfig });
    } else {
      plan.skipped.push({ id: b.id, reason: decision.reason });
    }
  }
  return plan;
}
