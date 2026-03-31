import { supabase } from "@/integrations/supabase/client";
import { SCOPE_CATEGORIES } from "@/lib/scope-categories";

/** Standard section titles used for catalog item linking */
export const CATALOG_SECTION_OPTIONS = SCOPE_CATEGORIES
  .filter((c) => c.id !== "outros")
  .map((c) => ({ id: c.id, label: c.label }));

export interface SupplierPrice {
  id: string;
  catalog_item_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  unit_price: number | null;
  currency: string;
  minimum_order_qty: number | null;
  lead_time_days: number | null;
  is_primary: boolean;
  is_active: boolean;
  suppliers?: { id: string; name: string } | null;
}

/** Get all supplier prices for a catalog item, primary first */
export async function getSupplierPrices(catalogItemId: string): Promise<SupplierPrice[]> {
  const { data, error } = await supabase
    .from("catalog_item_supplier_prices")
    .select("*, suppliers:supplier_id(id, name)")
    .eq("catalog_item_id", catalogItemId)
    .order("is_primary", { ascending: false })
    .order("unit_price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupplierPrice[];
}

/** Get only the primary supplier price for a catalog item */
export async function getPrimarySupplierPrice(catalogItemId: string): Promise<SupplierPrice | null> {
  const { data, error } = await supabase
    .from("catalog_item_supplier_prices")
    .select("*, suppliers:supplier_id(id, name)")
    .eq("catalog_item_id", catalogItemId)
    .eq("is_primary", true)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as SupplierPrice | null;
}

/** Get active alternative (non-primary) supplier prices */
export async function getAlternativeSupplierPrices(catalogItemId: string): Promise<SupplierPrice[]> {
  const { data, error } = await supabase
    .from("catalog_item_supplier_prices")
    .select("*, suppliers:supplier_id(id, name)")
    .eq("catalog_item_id", catalogItemId)
    .eq("is_primary", false)
    .eq("is_active", true)
    .order("unit_price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupplierPrice[];
}

/** Build a snapshot object of supplier price data for embedding in a budget item */
export function buildSupplierPriceSnapshot(price: SupplierPrice) {
  return {
    catalog_item_supplier_price_id: price.id,
    supplier_id: price.supplier_id,
    supplier_name: (price.suppliers as any)?.name ?? null,
    supplier_sku: price.supplier_sku,
    unit_price: price.unit_price,
    currency: price.currency,
    snapshot_at: new Date().toISOString(),
  };
}

// ─── Section linking helpers ──────────────────────────────────────

/** Get allowed section titles for a catalog item */
export async function getItemSections(catalogItemId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("catalog_item_sections")
    .select("section_title")
    .eq("catalog_item_id", catalogItemId);
  if (error) throw error;
  return (data ?? []).map((r) => r.section_title);
}

/** Set allowed sections for a catalog item (replaces all) */
export async function setItemSections(catalogItemId: string, sectionTitles: string[]) {
  // Delete existing
  await supabase
    .from("catalog_item_sections")
    .delete()
    .eq("catalog_item_id", catalogItemId);

  if (sectionTitles.length === 0) return;

  const rows = sectionTitles.map((t) => ({
    catalog_item_id: catalogItemId,
    section_title: t,
  }));
  const { error } = await supabase.from("catalog_item_sections").insert(rows);
  if (error) throw error;
}

// ─── Autocomplete helper ──────────────────────────────────────────

/** Search catalog items filtered by allowed section title, for autocomplete */
export async function searchCatalogItemsBySection(
  searchText: string,
  sectionTitle: string,
  limit = 10,
): Promise<Array<{
  id: string;
  name: string;
  description: string | null;
  unit_of_measure: string | null;
  item_type: string;
}>> {
  // Get item IDs allowed for this section
  const { data: links } = await supabase
    .from("catalog_item_sections")
    .select("catalog_item_id")
    .eq("section_title", sectionTitle);

  const allowedIds = (links ?? []).map((l) => l.catalog_item_id);
  if (allowedIds.length === 0) return [];

  let query = supabase
    .from("catalog_items")
    .select("id, name, description, unit_of_measure, item_type")
    .in("id", allowedIds)
    .eq("is_active", true)
    .limit(limit);

  if (searchText) {
    query = query.ilike("search_text", `%${searchText.toLowerCase()}%`);
  }

  const { data, error } = await query.order("name");
  if (error) throw error;
  return data ?? [];
}
