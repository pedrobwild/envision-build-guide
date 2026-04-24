import { supabase } from "@/integrations/supabase/client";
import {
  PUBLIC_SECTION_SELECT,
  PUBLIC_ITEM_SELECT,
  PUBLIC_ITEM_IMAGE_SELECT,
  PUBLIC_ADJUSTMENT_SELECT,
  PUBLIC_ROOM_SELECT,
} from "@/lib/public-columns";
import type { BudgetData, BudgetSection, BudgetItem, BudgetItemImage, BudgetAdjustment, BudgetRoom } from "@/types/budget";

interface RpcBudgetRow {
  id: string;
  project_name: string;
  client_name: string;
  condominio?: string | null;
  bairro?: string | null;
  metragem?: string | null;
  unit?: string | null;
  date?: string | null;
  validity_days?: number | null;
  prazo_dias_uteis?: number | null;
  estimated_weeks?: number | null;
  versao?: string | null;
  version_number?: number | null;
  consultora_comercial?: string | null;
  email_comercial?: string | null;
  status: string;
  public_id?: string | null;
  show_item_qty?: boolean | null;
  show_item_prices?: boolean | null;
  show_progress_bars?: boolean | null;
  show_optional_items?: boolean;
  generated_at?: string | null;
  disclaimer?: string | null;
  notes?: string | null;
  floor_plan_url?: string | null;
  view_count?: number;
  approved_at?: string | null;
  approved_by_name?: string | null;
  lead_email?: string | null;
  lead_name?: string | null;
  header_config?: Record<string, unknown> | null;
  budget_pdf_url?: string | null;
  manual_total?: number | null;
  is_addendum?: boolean | null;
  addendum_number?: number | null;
  addendum_summary?: string | null;
  addendum_approved_at?: string | null;
  addendum_approved_by_name?: string | null;
}

interface SectionRow {
  id: string;
  budget_id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  cover_image_url?: string | null;
  tags?: string[] | null;
  included_bullets?: string[] | null;
  excluded_bullets?: string[] | null;
  notes?: string | null;
  is_optional?: boolean;
  addendum_action?: "add" | "remove" | null;
}

interface ItemRow {
  id: string;
  section_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  qty?: number | null;
  unit?: string | null;
  coverage_type?: string;
  included_rooms?: string[];
  excluded_rooms?: string[];
  internal_total?: number | null;
  internal_unit_price?: number | null;
  bdi_percentage?: number | null;
  addendum_action?: "add" | "remove" | null;
}

interface ItemImageRow {
  id: string;
  item_id: string;
  url: string;
  is_primary?: boolean | null;
}

interface AdjustmentRow {
  id: string;
  budget_id: string;
  label: string;
  amount: number;
  sign: number;
}

interface RoomRow {
  id: string;
  budget_id: string;
  name: string;
  polygon: number[][] | unknown;
  order_index: number;
}

export async function fetchPublicBudget(publicId: string): Promise<BudgetData | null> {
  // Step 1: fetch budget via RPC
  const { data: budget, error: budgetError } = await supabase
    .rpc('get_public_budget', { p_public_id: publicId });

  if (budgetError) {
    console.error('RPC get_public_budget failed:', budgetError.message);
    return null;
  }
  if (!budget) return null;

  const budgetRow = budget as unknown as RpcBudgetRow;

  // Step 2: fetch sections, adjustments, rooms in parallel
  const [sectionsRes, adjustmentsRes, roomsRes] = await Promise.all([
    supabase
      .from('sections')
      .select(PUBLIC_SECTION_SELECT)
      .eq('budget_id', budgetRow.id)
      .order('order_index'),
    supabase
      .from('adjustments')
      .select(PUBLIC_ADJUSTMENT_SELECT)
      .eq('budget_id', budgetRow.id),
    supabase
      .from('rooms')
      .select(PUBLIC_ROOM_SELECT)
      .eq('budget_id', budgetRow.id)
      .order('order_index'),
  ]);

  if (sectionsRes.error) console.error('Failed to fetch sections:', sectionsRes.error.message);
  if (adjustmentsRes.error) console.error('Failed to fetch adjustments:', adjustmentsRes.error.message);
  if (roomsRes.error) console.error('Failed to fetch rooms:', roomsRes.error.message);

  const sections = (sectionsRes.data ?? []) as unknown as SectionRow[];
  const adjustments = (adjustmentsRes.data ?? []) as unknown as AdjustmentRow[];
  const rooms = (roomsRes.data ?? []) as unknown as RoomRow[];

  const sectionIds = sections.map(s => s.id);

  // Step 3: fetch items (depends on sectionIds)
  const { data: itemsRaw, error: itemsError } = await supabase
    .from('items')
    .select(PUBLIC_ITEM_SELECT)
    .in('section_id', sectionIds.length ? sectionIds : ['__none__'])
    .order('order_index');

  if (itemsError) console.error('Failed to fetch items:', itemsError.message);
  const items = (itemsRaw ?? []) as unknown as ItemRow[];

  // Step 4: fetch item images (depends on itemIds)
  const itemIds = items.map(i => i.id);
  const { data: itemImagesRaw, error: imagesError } = await supabase
    .from('item_images')
    .select(PUBLIC_ITEM_IMAGE_SELECT)
    .in('item_id', itemIds.length ? itemIds : ['__none__']);

  if (imagesError) console.error('Failed to fetch item_images:', imagesError.message);
  const itemImages = (itemImagesRaw ?? []) as unknown as ItemImageRow[];

  // Attach items + images to sections
  const enrichedSections: BudgetSection[] = sections.map(section => {
    const sectionItems: BudgetItem[] = items
      .filter(i => i.section_id === section.id)
      .map(item => ({
        ...item,
        images: itemImages.filter(img => img.item_id === item.id) as BudgetItemImage[],
      }));

    return { ...section, items: sectionItems };
  });

  return {
    ...budgetRow,
    sections: enrichedSections,
    adjustments: adjustments as BudgetAdjustment[],
    rooms: rooms.map((r): BudgetRoom => ({
      id: r.id,
      name: r.name,
      polygon: Array.isArray(r.polygon) ? r.polygon as number[][] : [],
    })),
  };
}

interface SectionLike {
  items?: ItemLike[];
  qty?: number | null;
  section_price?: number | null;
  addendum_action?: "add" | "remove" | null;
}

interface ItemLike {
  internal_total?: number | null;
  internal_unit_price?: number | null;
  qty?: number | null;
  bdi_percentage?: number | null;
  addendum_action?: "add" | "remove" | null;
}

interface AdjustmentLike {
  sign: number;
  amount: number;
}

/** Raw subtotal of a section (sum of items × qty), ignoring addendum_action sign. */
export function calculateSectionSubtotal(section: SectionLike): number {
  const items = section.items || [];
  const qty = section.qty || 1;

  if (items.length > 0) {
    const itemsSum = items.reduce((sum: number, item: ItemLike) => {
      // Skip items removed by addendum from raw subtotal — they're handled
      // explicitly by calculateBudgetTotal as a NEGATIVE.
      if (item.addendum_action === "remove") return sum;
      const unitPrice = Number(item.internal_unit_price) || 0;
      const itemQty = Number(item.qty) || (unitPrice > 0 ? 1 : 0);
      const bdi = Number(item.bdi_percentage) || 0;

      if (unitPrice > 0) {
        return sum + unitPrice * (1 + bdi / 100) * itemQty;
      }
      const cost = Number(item.internal_total) || 0;
      if (cost > 0) {
        const fallbackQty = Number(item.qty) || 1;
        return sum + cost * (1 + bdi / 100) * fallbackQty;
      }
      return sum;
    }, 0);
    if (itemsSum > 0) return itemsSum * qty;
  }

  if (section.section_price != null) {
    return Number(section.section_price) * qty;
  }
  return 0;
}

/** Sum of values that the addendum REMOVES (always positive number; subtract it). */
function calculateRemovedTotal(section: SectionLike): number {
  const items = section.items || [];
  const qty = section.qty || 1;
  if (section.addendum_action === "remove") {
    // Whole section removed — original value (without filter) is the negative
    const itemsSum = items.reduce((sum, item) => {
      const unitPrice = Number(item.internal_unit_price) || 0;
      const itemQty = Number(item.qty) || (unitPrice > 0 ? 1 : 0);
      const bdi = Number(item.bdi_percentage) || 0;
      if (unitPrice > 0) return sum + unitPrice * (1 + bdi / 100) * itemQty;
      const cost = Number(item.internal_total) || 0;
      if (cost > 0) {
        const fallbackQty = Number(item.qty) || 1;
        return sum + cost * (1 + bdi / 100) * fallbackQty;
      }
      return sum;
    }, 0);
    if (itemsSum > 0) return itemsSum * qty;
    if (section.section_price != null) return Number(section.section_price) * qty;
    return 0;
  }

  // Section kept — subtract individually-removed items
  return items.reduce((sum, item) => {
    if (item.addendum_action !== "remove") return sum;
    const unitPrice = Number(item.internal_unit_price) || 0;
    const itemQty = Number(item.qty) || (unitPrice > 0 ? 1 : 0);
    const bdi = Number(item.bdi_percentage) || 0;
    if (unitPrice > 0) return sum + unitPrice * (1 + bdi / 100) * itemQty;
    const cost = Number(item.internal_total) || 0;
    if (cost > 0) {
      const fallbackQty = Number(item.qty) || 1;
      return sum + cost * (1 + bdi / 100) * fallbackQty;
    }
    return sum;
  }, 0) * qty;
}

export function calculateBudgetTotal(
  sections: SectionLike[],
  adjustments: AdjustmentLike[] | null | undefined
): number {
  const sectionsTotal = sections.reduce(
    (sum, s) => sum + calculateSectionSubtotal(s),
    0
  );
  const removedTotal = sections.reduce(
    (sum, s) => sum + calculateRemovedTotal(s),
    0
  );
  const adjustmentsTotal = (adjustments || []).reduce(
    (sum: number, adj: AdjustmentLike) => sum + adj.sign * Number(adj.amount),
    0
  );
  return sectionsTotal - removedTotal + adjustmentsTotal;
}

/** Net delta of an addendum: (added items + new sections) − (removed items + sections). */
export function calculateAddendumDelta(sections: SectionLike[]): {
  added: number;
  removed: number;
  net: number;
} {
  let added = 0;
  let removed = 0;
  sections.forEach((s) => {
    if (s.addendum_action === "add") {
      added += calculateSectionSubtotal(s);
    } else if (s.addendum_action === "remove") {
      removed += calculateRemovedTotal(s);
    } else {
      // Section kept — only flag-level item changes matter
      (s.items || []).forEach((item) => {
        if (item.addendum_action === "add") {
          const unitPrice = Number(item.internal_unit_price) || 0;
          const itemQty = Number(item.qty) || (unitPrice > 0 ? 1 : 0);
          const bdi = Number(item.bdi_percentage) || 0;
          const sectionQty = Number(s.qty) || 1;
          if (unitPrice > 0) {
            added += unitPrice * (1 + bdi / 100) * itemQty * sectionQty;
          } else {
            const cost = Number(item.internal_total) || 0;
            if (cost > 0) {
              const fallbackQty = Number(item.qty) || 1;
              added += cost * (1 + bdi / 100) * fallbackQty * sectionQty;
            }
          }
        } else if (item.addendum_action === "remove") {
          removed += calculateRemovedTotal({ ...s, items: [item], addendum_action: null });
        }
      });
    }
  });
  return { added, removed, net: added - removed };
}
