import { supabase } from "@/integrations/supabase/client";

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
