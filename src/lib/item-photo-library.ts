import { supabase } from "@/integrations/supabase/client";

/**
 * Save or update a photo in the global item photo library.
 * Called when a user uploads a photo to any item.
 */
export async function saveToPhotoLibrary(itemName: string, url: string) {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("item_photo_library")
    .upsert(
      {
        item_name: itemName.trim(),
        item_name_normalized: normalized,
        url,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "item_name_normalized,created_by" }
    );
}

/**
 * Look up a photo from the global library by item name.
 * Returns the URL if found, null otherwise.
 */
export async function lookupPhotoFromLibrary(itemName: string): Promise<string | null> {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await supabase
    .from("item_photo_library")
    .select("url")
    .eq("item_name_normalized", normalized)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  return data?.url || null;
}

/**
 * Look up photos for multiple item names at once.
 * Returns a Map of normalized name → url.
 */
export async function lookupPhotosFromLibrary(itemNames: string[]): Promise<Map<string, string>> {
  const normalized = [...new Set(itemNames.map(n => n.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return new Map();

  const { data } = await supabase
    .from("item_photo_library")
    .select("item_name_normalized, url")
    .in("item_name_normalized", normalized)
    .order("updated_at", { ascending: false });

  const result = new Map<string, string>();
  if (data) {
    for (const row of data) {
      // First match wins (most recent due to order)
      if (!result.has(row.item_name_normalized)) {
        result.set(row.item_name_normalized, row.url);
      }
    }
  }
  return result;
}
