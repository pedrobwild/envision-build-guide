import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  resolveDefaultMedia,
  type DefaultMediaSource,
  type MediaConfigShape,
} from "@/lib/default-media-policy";
import { hasManualMedia } from "@/lib/media-replication";

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
    .select("media_config")
    .eq("id", budgetId)
    .maybeSingle();

  if (readErr) {
    console.warn(
      `[media-guardrail] Falha ao ler media_config de ${budgetId}:`,
      readErr.message
    );
    return { applied: false, reason: "db_error", message: readErr.message };
  }

  // 2. GUARDRAIL: orçamentos com mídia manual NUNCA são alterados.
  if (hasManualMedia(current?.media_config as MediaConfigShape | null)) {
    console.info(
      `[media-guardrail] Orçamento ${budgetId} possui upload manual — replicação pulada.`
    );
    return { applied: false, reason: "manual_media_present" };
  }

  // 3. Resolve mídia padrão (template explícito → primeiro ativo → hardcoded).
  const { media, source } = await resolveDefaultMedia(explicitTemplateId ?? null);

  // 4. Aplica.
  const { error: updErr } = await supabase
    .from("budgets")
    .update({ media_config: media as unknown as Json })
    .eq("id", budgetId);

  if (updErr) {
    console.warn(
      `[media-guardrail] Falha ao aplicar mídia padrão em ${budgetId}:`,
      updErr.message
    );
    return { applied: false, reason: "db_error", message: updErr.message };
  }

  return { applied: true, source, media };
}
