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

/**
 * Seed a budget's sections and items from a template.
 * Falls back to default sections if no template is provided.
 * Deletes existing sections first to avoid duplicates.
 */
export async function seedFromTemplate(budgetId: string, templateId: string | null) {
  // Delete existing items first, then sections
  const { data: existingSections } = await supabase
    .from("sections")
    .select("id")
    .eq("budget_id", budgetId);

  const sectionIds = existingSections?.map(s => s.id) ?? [];
  if (sectionIds.length > 0) {
    const { error: itemsDelErr } = await supabase.from("items").delete().in("section_id", sectionIds);
    if (itemsDelErr) throw new Error(`Falha ao limpar itens existentes: ${itemsDelErr.message}`);
  }
  const { error: secDelErr } = await supabase.from("sections").delete().eq("budget_id", budgetId);
  if (secDelErr) throw new Error(`Falha ao limpar seções existentes: ${secDelErr.message}`);

  if (!templateId) {
    // Guardrail: nunca sobrescreve upload manual. Aplica padrão em camadas
    // (template selecionado → primeiro ativo → hardcoded) somente se o
    // orçamento ainda não tiver mídia.
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

    const { seedDefaultSections } = await import("@/lib/default-budget-sections");
    return seedDefaultSections(budgetId);
  }

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

  const { data: templateSections, error: secErr } = await supabase
    .from("budget_template_sections")
    .select("id, title, subtitle, order_index, notes, tags, included_bullets, excluded_bullets, is_optional")
    .eq("template_id", templateId)
    .order("order_index");

  if (secErr) throw secErr;
  if (!templateSections || templateSections.length === 0) {
    throw new Error("Template não encontrado ou está vazio");
  }

  for (const tSec of templateSections as TemplateSectionRow[]) {
    const sectionPayload = {
      budget_id: budgetId,
      title: tSec.title,
      subtitle: tSec.subtitle || null,
      order_index: tSec.order_index,
      notes: tSec.notes || null,
      tags: (tSec.tags || []) as Json,
      included_bullets: (tSec.included_bullets || []) as Json,
      excluded_bullets: (tSec.excluded_bullets || []) as Json,
      is_optional: tSec.is_optional || false,
    };
    const { data: section } = await supabase
      .from("sections")
      .insert(sectionPayload)
      .select("id")
      .single();

    if (!section) continue;

    // Load items for this template section
    const { data: templateItems } = await supabase
      .from("budget_template_items")
      .select("title, description, unit, qty, order_index, coverage_type, reference_url, internal_unit_price, internal_total, bdi_percentage")
      .eq("template_section_id", tSec.id)
      .order("order_index");

    if (!templateItems || templateItems.length === 0) continue;

    for (const tItem of templateItems as TemplateItemRow[]) {
      await supabase.from("items").insert({
        section_id: section.id,
        title: tItem.title,
        description: tItem.description || null,
        unit: tItem.unit || null,
        qty: tItem.qty ?? null,
        order_index: tItem.order_index,
        coverage_type: tItem.coverage_type || "geral",
        reference_url: tItem.reference_url || null,
        internal_unit_price: tItem.internal_unit_price ?? null,
        internal_total: tItem.internal_total ?? null,
        bdi_percentage: tItem.bdi_percentage ?? 0,
      });
    }
  }
}
