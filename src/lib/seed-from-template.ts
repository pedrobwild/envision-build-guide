import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { sanitizeDefaultMedia, type MediaConfigShape } from "@/lib/default-media-policy";

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
    // Fallback: ainda copia a mídia padrão (do primeiro template ativo)
    // para que orçamentos criados sem template já tenham a galeria padrão.
    try {
      const { data: defaultTpl } = await supabase
        .from("budget_templates")
        .select("media_config")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const defaultMc = defaultTpl?.media_config as
        | { video3d?: string; projeto3d?: string[]; projetoExecutivo?: string[]; fotos?: string[] }
        | null
        | undefined;
      const hasDefaultMedia =
        !!defaultMc &&
        (
          !!defaultMc.video3d ||
          (Array.isArray(defaultMc.projeto3d) && defaultMc.projeto3d.length > 0) ||
          (Array.isArray(defaultMc.projetoExecutivo) && defaultMc.projetoExecutivo.length > 0) ||
          (Array.isArray(defaultMc.fotos) && defaultMc.fotos.length > 0)
        );

      if (hasDefaultMedia) {
        await supabase
          .from("budgets")
          .update({ media_config: defaultMc as unknown as Json })
          .eq("id", budgetId);
      }
    } catch (err) {
      console.warn("Falha ao aplicar mídia padrão (sem template):", err);
    }

    const { seedDefaultSections } = await import("@/lib/default-budget-sections");
    return seedDefaultSections(budgetId);
  }

  // Load template sections with their items + media_config
  const { data: templateRow, error: tplErr } = await supabase
    .from("budget_templates")
    .select("media_config")
    .eq("id", templateId)
    .maybeSingle();

  if (tplErr) {
    console.warn("Falha ao carregar template (media_config):", tplErr.message);
  }

  // Copy media_config from template to budget — only if it has actual content
  const mc = templateRow?.media_config as
    | { video3d?: string; projeto3d?: string[]; projetoExecutivo?: string[]; fotos?: string[] }
    | null
    | undefined;
  const hasMediaContent =
    !!mc &&
    (
      !!mc.video3d ||
      (Array.isArray(mc.projeto3d) && mc.projeto3d.length > 0) ||
      (Array.isArray(mc.projetoExecutivo) && mc.projetoExecutivo.length > 0) ||
      (Array.isArray(mc.fotos) && mc.fotos.length > 0)
    );

  if (hasMediaContent) {
    const { error: mediaErr } = await supabase
      .from("budgets")
      .update({ media_config: mc as unknown as Json })
      .eq("id", budgetId);
    if (mediaErr) {
      console.warn("Falha ao copiar media_config do template:", mediaErr.message);
    }
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
