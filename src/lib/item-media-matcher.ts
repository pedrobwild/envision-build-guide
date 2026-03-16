import { supabase } from "@/integrations/supabase/client";
import { getCategoryForSection } from "@/lib/scope-categories";
import { lookupPhotosFromLibrary } from "@/lib/item-photo-library";

const MATCHABLE_CATEGORIES = new Set(["marcenaria", "mobiliario", "eletro"]);

/**
 * After importing items into new sections, find existing items (from other budgets)
 * with the same title in matchable categories (marcenaria, mobiliário, eletro)
 * and copy their images + description to the new items.
 */
export async function matchAndCopyItemMedia(
  budgetId: string,
  newSections: { id: string; title: string }[]
) {
  // 1. Filter sections that belong to matchable categories
  const matchableSections = newSections.filter((s) => {
    const cat = getCategoryForSection(s.title);
    return MATCHABLE_CATEGORIES.has(cat.id);
  });

  if (matchableSections.length === 0) return { matched: 0 };

  const matchableSectionIds = matchableSections.map((s) => s.id);

  // 2. Load new items from matchable sections
  const { data: newItems } = await supabase
    .from("items")
    .select("id, title, description, section_id")
    .in("section_id", matchableSectionIds);

  if (!newItems || newItems.length === 0) return { matched: 0 };

  // 3. Collect unique titles to search for
  const titlesToMatch = [...new Set(newItems.map((i) => i.title.trim().toLowerCase()).filter(Boolean))];
  if (titlesToMatch.length === 0) return { matched: 0 };

  // 4. Find existing items with matching titles (from ANY budget, not just this one)
  //    We query all items and filter by title match + must have images
  const { data: allCandidateItems } = await supabase
    .from("items")
    .select("id, title, description, section_id")
    .not("section_id", "in", `(${matchableSectionIds.join(",")})`)
    .limit(1000);

  if (!allCandidateItems || allCandidateItems.length === 0) return { matched: 0 };

  // Filter candidates whose titles match our new items
  const candidatesByTitle = new Map<string, typeof allCandidateItems>();
  for (const candidate of allCandidateItems) {
    const key = candidate.title.trim().toLowerCase();
    if (titlesToMatch.includes(key)) {
      if (!candidatesByTitle.has(key)) candidatesByTitle.set(key, []);
      candidatesByTitle.get(key)!.push(candidate);
    }
  }

  if (candidatesByTitle.size === 0) return { matched: 0 };

  // 5. Load images for candidate items
  const candidateItemIds = [...candidatesByTitle.values()].flat().map((c) => c.id);
  const { data: candidateImages } = await supabase
    .from("item_images")
    .select("*")
    .in("item_id", candidateItemIds.slice(0, 500));

  if (!candidateImages || candidateImages.length === 0) return { matched: 0 };

  // Group images by item_id
  const imagesByItemId = new Map<string, typeof candidateImages>();
  for (const img of candidateImages) {
    if (!imagesByItemId.has(img.item_id)) imagesByItemId.set(img.item_id, []);
    imagesByItemId.get(img.item_id)!.push(img);
  }

  // 6. For each new item, find the best candidate (one with images) and copy
  let matched = 0;
  const imageInserts: { item_id: string; url: string; is_primary: boolean }[] = [];
  const descriptionUpdates: { id: string; description: string }[] = [];

  for (const newItem of newItems) {
    const key = newItem.title.trim().toLowerCase();
    const candidates = candidatesByTitle.get(key);
    if (!candidates) continue;

    // Find the first candidate that has images
    const bestCandidate = candidates.find((c) => imagesByItemId.has(c.id));
    if (!bestCandidate) {
      // No candidate with images, but maybe copy description
      const descCandidate = candidates[0];
      if (descCandidate?.description && !newItem.description) {
        descriptionUpdates.push({ id: newItem.id, description: descCandidate.description });
        matched++;
      }
      continue;
    }

    const images = imagesByItemId.get(bestCandidate.id)!;
    for (const img of images) {
      imageInserts.push({
        item_id: newItem.id,
        url: img.url,
        is_primary: img.is_primary ?? false,
      });
    }

    // Also copy description if new item doesn't have one
    if (bestCandidate.description && !newItem.description) {
      descriptionUpdates.push({ id: newItem.id, description: bestCandidate.description });
    }

    matched++;
  }

  // 7. Batch insert images
  if (imageInserts.length > 0) {
    await supabase.from("item_images").insert(imageInserts);
  }

  // 8. Update descriptions
  for (const upd of descriptionUpdates) {
    await supabase.from("items").update({ description: upd.description }).eq("id", upd.id);
  }

  console.log(`[ItemMediaMatcher] Matched ${matched} items, copied ${imageInserts.length} images`);
  return { matched, imagesCopied: imageInserts.length };
}
