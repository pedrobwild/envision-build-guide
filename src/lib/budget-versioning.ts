import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure a budget has a version_group_id. If it doesn't, set it to its own id.
 */
export async function ensureVersionGroup(budgetId: string): Promise<string> {
  const { data } = await supabase
    .from("budgets")
    .select("id, version_group_id")
    .eq("id", budgetId)
    .single();

  if (!data) throw new Error("Orçamento não encontrado");

  if (data.version_group_id) return data.version_group_id;

  // First version — use the budget's own id as group id
  await supabase
    .from("budgets")
    .update({ version_group_id: budgetId, version_number: 1, is_current_version: true })
    .eq("id", budgetId);

  return budgetId;
}

/**
 * Get all versions for a budget's group, ordered by version_number desc.
 */
export async function getVersionHistory(budgetId: string) {
  const groupId = await ensureVersionGroup(budgetId);

  const { data, error } = await supabase
    .from("budgets")
    .select("id, version_number, is_current_version, status, created_at, versao, project_name, client_name")
    .eq("version_group_id", groupId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return { versions: data || [], groupId };
}

/**
 * Get the next version number for a group.
 */
async function getNextVersionNumber(groupId: string): Promise<number> {
  const { data } = await supabase
    .from("budgets")
    .select("version_number")
    .eq("version_group_id", groupId)
    .order("version_number", { ascending: false })
    .limit(1);

  return ((data?.[0]?.version_number as number) || 0) + 1;
}

/**
 * Deep-duplicate a budget as a new version in the same group.
 * Copies: sections, items, item_images, adjustments, rooms.
 * The new version becomes the current one; old current is demoted.
 */
export async function duplicateBudgetAsVersion(
  sourceBudgetId: string,
  userId: string
): Promise<string> {
  const groupId = await ensureVersionGroup(sourceBudgetId);
  const nextVersion = await getNextVersionNumber(groupId);

  // 1. Load source budget
  const { data: source } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", sourceBudgetId)
    .single();

  if (!source) throw new Error("Orçamento fonte não encontrado");

  // 2. Demote all current versions in this group
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId);

  // 3. Create new budget (copy metadata)
  const { id, created_at, updated_at, public_id, public_token_hash, view_count, last_viewed_at, approved_at, approved_by_name, generated_at, ...meta } = source;

  const { data: newBudget, error: budgetErr } = await supabase
    .from("budgets")
    .insert({
      ...meta,
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: true,
      versao: `${nextVersion}`,
      status: "draft",
      created_by: userId,
      view_count: 0,
    })
    .select()
    .single();

  if (budgetErr || !newBudget) throw budgetErr || new Error("Falha ao criar versão");

  // 4. Copy sections
  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("budget_id", sourceBudgetId)
    .order("order_index");

  for (const sec of sections || []) {
    const { id: oldSecId, created_at: _ca, budget_id: _bid, ...secData } = sec;

    const { data: newSec } = await supabase
      .from("sections")
      .insert({ ...secData, budget_id: newBudget.id })
      .select()
      .single();

    if (!newSec) continue;

    // Copy items for this section
    const { data: items } = await supabase
      .from("items")
      .select("*")
      .eq("section_id", oldSecId)
      .order("order_index");

    for (const item of items || []) {
      const { id: oldItemId, created_at: _ica, section_id: _sid, ...itemData } = item;

      const { data: newItem } = await supabase
        .from("items")
        .insert({ ...itemData, section_id: newSec.id })
        .select()
        .single();

      if (!newItem) continue;

      // Copy item images
      const { data: images } = await supabase
        .from("item_images")
        .select("*")
        .eq("item_id", oldItemId);

      if (images && images.length > 0) {
        await supabase.from("item_images").insert(
          images.map(({ id, created_at, item_id, ...imgData }) => ({
            ...imgData,
            item_id: newItem.id,
          }))
        );
      }
    }
  }

  // 5. Copy adjustments
  const { data: adjustments } = await supabase
    .from("adjustments")
    .select("*")
    .eq("budget_id", sourceBudgetId);

  if (adjustments && adjustments.length > 0) {
    await supabase.from("adjustments").insert(
      adjustments.map(({ id, created_at, budget_id, ...adjData }) => ({
        ...adjData,
        budget_id: newBudget.id,
      }))
    );
  }

  // 6. Copy rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .eq("budget_id", sourceBudgetId);

  if (rooms && rooms.length > 0) {
    await supabase.from("rooms").insert(
      rooms.map(({ id, created_at, budget_id, ...roomData }) => ({
        ...roomData,
        budget_id: newBudget.id,
      }))
    );
  }

  return newBudget.id;
}

/**
 * Set a specific version as the current one.
 * Demotes all others in the group.
 */
export async function setCurrentVersion(budgetId: string, groupId: string) {
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId);

  await supabase
    .from("budgets")
    .update({ is_current_version: true })
    .eq("id", budgetId);
}

/**
 * Import (PDF/XLSX) into an existing budget group as a new version.
 * Called after the import modal creates a new budget — we just assign it to the group.
 */
export async function assignImportedBudgetToGroup(
  newBudgetId: string,
  existingBudgetId: string
) {
  const groupId = await ensureVersionGroup(existingBudgetId);
  const nextVersion = await getNextVersionNumber(groupId);

  // Demote current
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId);

  // Assign the imported budget to this group
  await supabase
    .from("budgets")
    .update({
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: true,
      versao: `${nextVersion}`,
    })
    .eq("id", newBudgetId);
}
