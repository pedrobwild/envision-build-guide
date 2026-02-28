import { supabase } from "@/integrations/supabase/client";

export async function fetchPublicBudget(publicId: string) {
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('public_id', publicId)
    .eq('status', 'published')
    .single();

  if (budgetError || !budget) return null;

  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('budget_id', budget.id)
    .order('order_index');

  const sectionIds = (sections || []).map(s => s.id);

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .in('section_id', sectionIds.length ? sectionIds : ['__none__'])
    .order('order_index');

  const itemIds = (items || []).map(i => i.id);

  const { data: itemImages } = await supabase
    .from('item_images')
    .select('*')
    .in('item_id', itemIds.length ? itemIds : ['__none__']);

  const { data: adjustments } = await supabase
    .from('adjustments')
    .select('*')
    .eq('budget_id', budget.id);

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('budget_id', budget.id)
    .order('order_index');

  // Attach items + images to sections
  const enrichedSections = (sections || []).map(section => {
    const sectionItems = (items || [])
      .filter(i => i.section_id === section.id)
      .map(item => ({
        ...item,
        images: (itemImages || []).filter(img => img.item_id === item.id),
      }));

    return { ...section, items: sectionItems };
  });

  return {
    ...budget,
    sections: enrichedSections,
    adjustments: adjustments || [],
    rooms: (rooms || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      polygon: r.polygon || [],
    })),
  };
}

export function calculateSectionSubtotal(section: any): number {
  if (section.section_price != null) {
    return Number(section.section_price) * (section.qty || 1);
  }
  return (section.items || []).reduce(
    (sum: number, item: any) => sum + (Number(item.internal_total) || 0),
    0
  );
}

export function calculateBudgetTotal(sections: any[], adjustments: any[]): number {
  const sectionsTotal = sections.reduce(
    (sum, s) => sum + calculateSectionSubtotal(s),
    0
  );
  const adjustmentsTotal = (adjustments || []).reduce(
    (sum: number, adj: any) => sum + (adj.sign * Number(adj.amount)),
    0
  );
  return sectionsTotal + adjustmentsTotal;
}
