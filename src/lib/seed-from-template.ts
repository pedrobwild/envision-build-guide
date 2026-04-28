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
  // Delete existing items first, then sections
  const { data: existingSections } = await supabase
    .from("sections")
    .select("id")
    .eq("budget_id", budgetId);

  const sectionIds = existingSections?.map(s => s.id) ?? [];
  if (sectionIds.length > 0) {
    report("Limpando itens existentes…", 6);
    const { error: itemsDelErr } = await supabase.from("items").delete().in("section_id", sectionIds);
    if (itemsDelErr) throw new Error(`Falha ao limpar itens existentes: ${itemsDelErr.message}`);
  }
  report("Limpando seções existentes…", 10);
  const { error: secDelErr } = await supabase.from("sections").delete().eq("budget_id", budgetId);
  if (secDelErr) throw new Error(`Falha ao limpar seções existentes: ${secDelErr.message}`);

  if (!templateId) {
    report("Aplicando mídia padrão…", 30);
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

  report("Carregando metadados do template…", 18);
  // Carrega metadados do template (incluindo desconto promocional padrão)
  const { data: tplMeta } = await supabase
    .from("budget_templates")
    .select("default_discount_amount")
    .eq("id", templateId)
    .maybeSingle();

  const { data: templateSections, error: secErr } = await supabase
    .from("budget_template_sections")
    .select("id, title, subtitle, order_index, notes, tags, included_bullets, excluded_bullets, is_optional")
    .eq("template_id", templateId)
    .order("order_index");

  if (secErr) throw secErr;
  if (!templateSections || templateSections.length === 0) {
    throw new Error("Template não encontrado ou está vazio");
  }

  const discountAmount = Number(tplMeta?.default_discount_amount ?? 0);

  const totalSections = templateSections.length;
  // Reservamos a faixa 22%–88% para o loop de criação de seções/itens.
  const SECTIONS_START = 22;
  const SECTIONS_END = 88;
  let processed = 0;

  for (const tSec of templateSections as TemplateSectionRow[]) {
    const pct = SECTIONS_START + Math.round((processed / totalSections) * (SECTIONS_END - SECTIONS_START));
    report(`Criando seção “${tSec.title}” (${processed + 1}/${totalSections})…`, pct);

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

    if (!section) { processed += 1; continue; }

    // Load items for this template section
    const { data: templateItems } = await supabase
      .from("budget_template_items")
      .select("title, description, unit, qty, order_index, coverage_type, reference_url, internal_unit_price, internal_total, bdi_percentage")
      .eq("template_section_id", tSec.id)
      .order("order_index");

    if (templateItems && templateItems.length > 0) {
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
    processed += 1;
  }

  if (discountAmount > 0) {
    report("Aplicando desconto promocional…", 92);
  }

  // ── Desconto promocional automático ──
  // Se o template tiver `default_discount_amount > 0`, cria seção "Descontos"
  // com item "Desconto promocional" de custo NEGATIVO desse valor.
  if (discountAmount > 0) {
    const { data: discountSection } = await supabase
      .from("sections")
      .insert({
        budget_id: budgetId,
        title: "Descontos",
        subtitle: "Aplicado sobre o subtotal do projeto",
        order_index: templateSections.length,
      })
      .select("id")
      .single();
    if (discountSection) {
      await supabase.from("items").insert({
        section_id: discountSection.id,
        title: "Desconto promocional",
        qty: 1,
        internal_unit_price: -discountAmount,
        bdi_percentage: 0,
        order_index: 0,
        coverage_type: "geral",
      });
    } else {
      logger.warn("[seed] Falha ao criar seção de desconto automático do template.");
    }
  }

  report("Pronto!", 100);
}
