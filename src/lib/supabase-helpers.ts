import { supabase } from "@/integrations/supabase/client";
import {
  PUBLIC_BUDGET_SELECT,
  PUBLIC_SECTION_SELECT,
  PUBLIC_ITEM_SELECT,
  PUBLIC_ITEM_IMAGE_SELECT,
  PUBLIC_ADJUSTMENT_SELECT,
  PUBLIC_ROOM_SELECT,
} from "@/lib/public-columns";

export async function fetchPublicBudget(publicId: string) {
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select(PUBLIC_BUDGET_SELECT)
    .eq('public_id', publicId)
    .in('status', ['published', 'minuta_solicitada'])
    .single() as { data: any; error: any };

  if (budgetError || !budget) return null;

  const { data: sections } = await supabase
    .from('sections')
    .select(PUBLIC_SECTION_SELECT)
    .eq('budget_id', budget.id)
    .order('order_index') as { data: any[]; error: any };

  const sectionIds = (sections || []).map(s => s.id);

  const { data: items } = await supabase
    .from('items')
    .select(PUBLIC_ITEM_SELECT)
    .in('section_id', sectionIds.length ? sectionIds : ['__none__'])
    .order('order_index');

  const itemIds = (items || []).map(i => i.id);

  const { data: itemImages } = await supabase
    .from('item_images')
    .select(PUBLIC_ITEM_IMAGE_SELECT)
    .in('item_id', itemIds.length ? itemIds : ['__none__']);

  const { data: adjustments } = await supabase
    .from('adjustments')
    .select(PUBLIC_ADJUSTMENT_SELECT)
    .eq('budget_id', budget.id);

  const { data: rooms } = await supabase
    .from('rooms')
    .select(PUBLIC_ROOM_SELECT)
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
  const items = section.items || [];
  const qty = section.qty || 1;

  // Sum item-level totals when available
  if (items.length > 0) {
    const itemsSum = items.reduce(
      (sum: number, item: any) => sum + (Number(item.internal_total) || 0),
      0
    );
    // If items have totals, use them; otherwise fall back to section_price
    if (itemsSum > 0) return itemsSum * qty;
  }

  // Flat section price (no item-level breakdown or all items have null totals)
  if (section.section_price != null) {
    return Number(section.section_price) * qty;
  }
  return 0;
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
