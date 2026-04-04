import { supabase } from "@/integrations/supabase/client";

/**
 * Seed a budget's sections and items from a template.
 * Falls back to default sections if no template is provided.
 */
export async function seedFromTemplate(budgetId: string, templateId: string | null) {
  if (!templateId) {
    // Fallback to legacy default sections
    const { seedDefaultSections } = await import("@/lib/default-budget-sections");
    return seedDefaultSections(budgetId);
  }

  // Load template sections with their items
  const { data: templateSections, error: secErr } = await supabase
    .from("budget_template_sections" as any)
    .select("id, title, subtitle, order_index, notes, tags, included_bullets, excluded_bullets, is_optional")
    .eq("template_id", templateId)
    .order("order_index");

  if (secErr) throw secErr;
  if (!templateSections || templateSections.length === 0) return;

  for (const tSec of templateSections as any[]) {
    const { data: section } = await supabase
      .from("sections")
      .insert({
        budget_id: budgetId,
        title: tSec.title,
        subtitle: tSec.subtitle || null,
        order_index: tSec.order_index,
        notes: tSec.notes || null,
        tags: tSec.tags || [],
        included_bullets: tSec.included_bullets || [],
        excluded_bullets: tSec.excluded_bullets || [],
        is_optional: tSec.is_optional || false,
      })
      .select("id")
      .single();

    if (!section) continue;

    // Load items for this template section
    const { data: templateItems } = await supabase
      .from("budget_template_items" as any)
      .select("title, description, unit, qty, order_index, coverage_type, reference_url, internal_unit_price, internal_total, bdi_percentage")
      .eq("template_section_id", tSec.id)
      .order("order_index");

    if (!templateItems || templateItems.length === 0) continue;

    for (const tItem of templateItems as any[]) {
      await supabase.from("items").insert({
        section_id: section.id,
        title: tItem.title,
        description: tItem.description || null,
        unit: tItem.unit || null,
        qty: tItem.qty || null,
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
