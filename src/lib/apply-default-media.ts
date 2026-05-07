import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  resolveDefaultMedia,
  type DefaultMediaSource,
  type MediaConfigShape,
} from "@/lib/default-media-policy";
import { hasManualMedia } from "@/lib/media-replication";

import { logger } from "@/lib/logger";

export type ApplyDefaultMediaResult =
  | { applied: true; source: DefaultMediaSource; media: MediaConfigShape }
  | { applied: false; reason: "manual_media_present" | "db_error"; message?: string };

/**
 * Guardrail centralizado para aplicação de mídia padrão.
 *
 * Lê o `media_config` atual do orçamento e PULA SEM EXCEÇÕES quando
 * detecta upload manual (vídeo, fotos, projeto executivo OU projeto3d
 * preenchido). Esta é a única porta de entrada permitida para qualquer
 * rotina que tente "replicar mídia padrão" em orçamentos existentes.
 *
 * Use SEMPRE esta função em vez de chamar diretamente
 * `update({ media_config })` durante fluxos de seed/replicação.
 */
export async function applyDefaultMediaWithGuardrail(
  budgetId: string,
  explicitTemplateId?: string | null
): Promise<ApplyDefaultMediaResult> {
  // 1. Lê o estado atual do orçamento.
  const { data: current, error: readErr } = await supabase
    .from("budgets")
    .select("media_config, public_id")
    .eq("id", budgetId)
    .maybeSingle();

  if (readErr) {
    logger.warn(
      `[media-guardrail] Falha ao ler media_config de ${budgetId}:`,
      readErr.message
    );
    return { applied: false, reason: "db_error", message: readErr.message };
  }

  // 2. GUARDRAIL: orçamentos com mídia manual NUNCA são alterados.
  if (hasManualMedia(current?.media_config as MediaConfigShape | null)) {
    logger.debug(
      `[media-guardrail] Orçamento ${budgetId} possui upload manual — replicação pulada.`
    );
    return { applied: false, reason: "manual_media_present" };
  }

  // 2b. GUARDRAIL EXTRA: mesmo sem media_config "manual" populado, se já existe
  // qualquer arquivo no Storage do publicId atual, considera upload customizado
  // e PULA. Protege contra re-injetar catálogo padrão por cima de fotos que o
  // time subiu na aba Mídia mas que ainda não foram promovidas para media_config.
  const publicId = (current as { public_id?: string | null })?.public_id;
  if (publicId) {
    const folders = ["3d", "fotos", "exec", "video"];
    const counts = await Promise.all(
      folders.map(async (f) => {
        const { data } = await supabase.storage
          .from("media")
          .list(`${publicId}/${f}`, { limit: 1 });
        return (data || []).filter(
          (x) => x.name && !x.name.startsWith(".") && x.name !== ".emptyFolderPlaceholder"
        ).length;
      })
    );
    if (counts.some((n) => n > 0)) {
      logger.debug(
        `[media-guardrail] Orçamento ${budgetId} tem arquivos no Storage (${publicId}) — replicação pulada.`
      );
      return { applied: false, reason: "manual_media_present" };
    }
  }

  // 3. Resolve mídia padrão (template explícito → primeiro ativo → hardcoded).
  const { media, source } = await resolveDefaultMedia(explicitTemplateId ?? null);

  // 4. Aplica.
  const { error: updErr } = await supabase
    .from("budgets")
    .update({ media_config: media as unknown as Json })
    .eq("id", budgetId);

  if (updErr) {
    logger.warn(
      `[media-guardrail] Falha ao aplicar mídia padrão em ${budgetId}:`,
      updErr.message
    );
    return { applied: false, reason: "db_error", message: updErr.message };
  }

  return { applied: true, source, media };
}
