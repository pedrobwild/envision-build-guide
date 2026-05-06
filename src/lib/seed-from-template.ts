import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { applyDefaultMediaWithGuardrail } from "@/lib/apply-default-media";

import { logger } from "@/lib/logger";

interface TemplateSectionRow {
  id: string;
  title: string;
  subtitle: string | null;
  order_index: number;
  notes: string | null;
  tags: unknown;
  included_bullets: unknown;
  excluded_bullets: unknown;
  is_optional: boolean;
}

interface TemplateItemRow {
  title: string;
  description: string | null;
  unit: string | null;
  qty: number | null;
  order_index: number;
  coverage_type: string;
  reference_url: string | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  bdi_percentage: number | null;
}

export interface SeedProgress {
  /** Fase atual em linguagem humana (ex.: "Limpando seções existentes…") */
  phase: string;
  /** 0–100. Quando indeterminado, omitir (UI mostra barra animada). */
  percent?: number;
}

export type SeedProgressCallback = (p: SeedProgress) => void;

/**
 * Seed a budget's sections and items from a template.
 * Falls back to default sections if no template is provided.
 * Deletes existing sections first to avoid duplicates.
 *
 * @param onProgress - callback opcional para reportar fases ao UI.
 */
export async function seedFromTemplate(
  budgetId: string,
  templateId: string | null,
  onProgress?: SeedProgressCallback,
) {
  const report = (phase: string, percent?: number) => {
    try { onProgress?.({ phase, percent }); } catch { /* UI failures must not break seed */ }
  };

  report("Verificando seções existentes…", 2);

  if (!templateId) {
    // Sem template: limpa via RPC (bypass de RLS) + aplica default sections via TS
    report("Limpando seções existentes…", 10);
    const { error: clearErr } = await supabase.rpc("seed_budget_from_template", {
      p_budget_id: budgetId,
      p_template_id: null as unknown as string,
    });
    if (clearErr) throw new Error(`Falha ao limpar seções: ${clearErr.message}`);

    report("Aplicando mídia padrão…", 30);
    try {
      const result = await applyDefaultMediaWithGuardrail(budgetId, null);
      if (result.applied && result.source === "hardcoded_fallback") {
        logger.debug("[seed] Mídia padrão aplicada via fallback hard-coded (sem template ativo).");
      } else if (!result.applied && result.reason === "manual_media_present") {
        logger.debug("[seed] Orçamento já possui mídia manual — preservada.");
      }
    } catch (err) {
      logger.warn("Falha ao aplicar mídia padrão (sem template):", err);
    }

    report("Criando seções padrão…", 60);
    const { seedDefaultSections } = await import("@/lib/default-budget-sections");
    const result = await seedDefaultSections(budgetId);
    report("Pronto!", 100);
    return result;
  }

  report("Aplicando mídia padrão…", 14);
  // Guardrail: replicação de mídia padrão (com template) também respeita
  // upload manual e nunca sobrescreve.
  try {
    const result = await applyDefaultMediaWithGuardrail(budgetId, templateId);
    if (result.applied && result.source === "hardcoded_fallback") {
      logger.debug("[seed] Mídia padrão aplicada via fallback hard-coded (template sem mídia válida).");
    } else if (!result.applied && result.reason === "manual_media_present") {
      logger.debug("[seed] Orçamento já possui mídia manual — preservada.");
    }
  } catch (err) {
    logger.warn("Falha ao resolver mídia padrão para o orçamento:", err);
  }

  report("Aplicando template (seções, itens, desconto)…", 40);
  // Usa RPC SECURITY DEFINER que valida via can_access_budget — assim
  // orçamentistas conseguem aplicar template em orçamentos da equipe
  // mesmo sem serem o estimator_owner.
  const { data: rpcRes, error: rpcErr } = await supabase.rpc("seed_budget_from_template", {
    p_budget_id: budgetId,
    p_template_id: templateId,
  });
  if (rpcErr) {
    if (/forbidden/i.test(rpcErr.message)) {
      throw new Error("Sem permissão para aplicar template neste orçamento.");
    }
    throw new Error(`Falha ao aplicar template: ${rpcErr.message}`);
  }

  const created = (rpcRes as { sections_created?: number } | null)?.sections_created ?? 0;
  if (created === 0) {
    throw new Error("Template não encontrado ou está vazio.");
  }

  report("Pronto!", 100);
}
