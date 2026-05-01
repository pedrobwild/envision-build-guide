import { supabase } from "@/integrations/supabase/client";
import { logVersionEvent } from "@/lib/version-audit";

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
  const { error: updErr } = await supabase
    .from("budgets")
    .update({ version_group_id: budgetId, version_number: 1, is_current_version: true })
    .eq("id", budgetId);

  if (updErr) throw new Error(`Falha ao inicializar grupo de versões: ${updErr.message}`);
  return budgetId;
}

/**
 * Get all versions for a budget's group, ordered by version_number desc.
 */
export async function getVersionHistory(budgetId: string) {
  const groupId = await ensureVersionGroup(budgetId);

  const { data, error } = await supabase
    .from("budgets")
    .select("id, version_number, is_current_version, is_published_version, status, created_at, versao, project_name, client_name, change_reason, parent_budget_id, created_by")
    .eq("version_group_id", groupId)
    .order("version_number", { ascending: false });

  if (error) throw error;

  // Enrich with creator names
  const creatorIds = [...new Set((data || []).map((v) => v.created_by).filter((id): id is string => Boolean(id)))];
  let profileMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name || ""]));
  }

  const versions = (data || []).map((v) => ({
    ...v,
    created_by_name: v.created_by ? profileMap[v.created_by] || "—" : "—",
  }));

  return { versions, groupId };
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
 * Deep-duplicate a budget as a new FORMAL version in the same group.
 * This is an EXPLICIT action — not triggered by auto-save.
 * Copies: sections, items, item_images, adjustments, rooms.
 * The new version becomes the current one; old current is demoted.
 */
export async function duplicateBudgetAsVersion(
  sourceBudgetId: string,
  userId: string,
  changeReason?: string
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

  // 2. Create new budget FIRST (insert before demote) — prevents orphan groups
  // where all versions get is_current_version=false if the insert fails.
  // Strip auto-generated / unique / version-specific fields so the new row
  // doesn't collide on UNIQUE constraints (public_id, sequential_code) and
  // gets a fresh lifecycle.
  const {
    id, created_at, updated_at, public_id, public_token_hash,
    view_count, last_viewed_at, approved_at, approved_by_name,
    generated_at, is_published_version, sequential_code,
    closed_at, contract_file_url, budget_pdf_url,
    version_group_id: _vgid, version_number: _vnum,
    is_current_version: _icv, parent_budget_id: _pbid,
    change_reason: _cr, status: _st, created_by: _cb,
    ...meta
  } = source;

  // Insert as is_current_version=false initially; we'll flip after demoting siblings.
  const { data: newBudget, error: budgetErr } = await supabase
    .from("budgets")
    .insert({
      ...meta,
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: false,
      is_published_version: false,
      parent_budget_id: sourceBudgetId,
      change_reason: changeReason || null,
      versao: `${nextVersion}`,
      status: "draft",
      created_by: userId,
      view_count: 0,
    })
    .select()
    .single();

  if (budgetErr || !newBudget) throw budgetErr || new Error("Falha ao criar versão");

  // 3. Demote siblings and promote the new version atomically (best-effort: two updates).
  // If any of these fail we still have a valid group state because the new row exists.
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId)
    .neq("id", newBudget.id);

  await supabase
    .from("budgets")
    .update({ is_current_version: true })
    .eq("id", newBudget.id);

  // Log audit events
  await logVersionEvent({
    event_type: "version_created",
    budget_id: newBudget.id,
    user_id: userId,
    metadata: { version_number: nextVersion, change_reason: changeReason || null, source_budget_id: sourceBudgetId },
  });
  await logVersionEvent({
    event_type: "version_cloned_from_previous",
    budget_id: newBudget.id,
    user_id: userId,
    metadata: { source_budget_id: sourceBudgetId, source_version: source.version_number ?? 1 },
  });

  // 4. Copy sections (batch)
  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("budget_id", sourceBudgetId)
    .order("order_index");

  if (sections && sections.length > 0) {
    const sectionInserts = sections.map(({ id, created_at, budget_id, ...secData }) => ({
      ...secData,
      budget_id: newBudget.id,
    }));

    const { data: newSections } = await supabase
      .from("sections")
      .insert(sectionInserts)
      .select();

    if (newSections && newSections.length > 0) {
      // Build old→new section ID map (order is preserved)
      const sectionIdMap = new Map<string, string>();
      sections.forEach((oldSec, i) => {
        if (newSections[i]) sectionIdMap.set(oldSec.id, newSections[i].id);
      });

      // Fetch ALL items for all old sections in one query
      const oldSectionIds = sections.map((s) => s.id);
      const { data: allItems } = await supabase
        .from("items")
        .select("*")
        .in("section_id", oldSectionIds)
        .order("order_index");

      if (allItems && allItems.length > 0) {
        const itemInserts = allItems.map(({ id, created_at, section_id, ...itemData }) => ({
          ...itemData,
          section_id: sectionIdMap.get(section_id) || section_id,
        }));

        const { data: newItems } = await supabase
          .from("items")
          .insert(itemInserts)
          .select();

        if (newItems && newItems.length > 0) {
          // Build old→new item ID map
          const itemIdMap = new Map<string, string>();
          allItems.forEach((oldItem, i) => {
            if (newItems[i]) itemIdMap.set(oldItem.id, newItems[i].id);
          });

          // Fetch ALL item_images for all old items in one query
          const oldItemIds = allItems.map((it) => it.id);
          const { data: allImages } = await supabase
            .from("item_images")
            .select("*")
            .in("item_id", oldItemIds);

          if (allImages && allImages.length > 0) {
            const imageInserts = allImages.map(({ id, created_at, item_id, ...imgData }) => ({
              ...imgData,
              item_id: itemIdMap.get(item_id) || item_id,
            }));

            await supabase.from("item_images").insert(imageInserts);
          }
        }
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

  // 7. Copy budget_tours (3D tours)
  const { data: tours } = await supabase
    .from("budget_tours")
    .select("*")
    .eq("budget_id", sourceBudgetId);

  if (tours && tours.length > 0) {
    await supabase.from("budget_tours").insert(
      tours.map(({ id, created_at, budget_id, ...tourData }) => ({
        ...tourData,
        budget_id: newBudget.id,
      }))
    );
  }

  // 8. Copy Storage media files (3d, fotos, exec, video) from old public_id → new public_id
  const oldPublicId = source.public_id as string | null;
  const newPublicId = newBudget.public_id as string | null;
  if (oldPublicId && newPublicId && oldPublicId !== newPublicId) {
    const folders = ["3d", "fotos", "exec", "video"];
    await Promise.all(
      folders.map(async (folder) => {
        const { data: files } = await supabase.storage
          .from("media")
          .list(`${oldPublicId}/${folder}`, { limit: 1000 });
        if (!files || files.length === 0) return;
        await Promise.all(
          files
            .filter((f) => f.name && !f.name.startsWith("."))
            .map((f) =>
              supabase.storage
                .from("media")
                .copy(
                  `${oldPublicId}/${folder}/${f.name}`,
                  `${newPublicId}/${folder}/${f.name}`
                )
            )
        );
      })
    );
  }

  return newBudget.id;
}

/**
 * Delete a DRAFT version from a group.
 * Safety: refuses to delete the current version, the published version,
 * any version not in 'draft' status, or the last remaining version.
 * Cleans up dependent rows (sections/items/images, adjustments, rooms, tours).
 *
 * Audit: `budget_events.budget_id` has ON DELETE CASCADE, so we cannot log on
 * the deleted version itself (the event would be wiped along with the row).
 * Instead, we log a `version_deleted` event on a SURVIVING sibling in the same
 * group (lowest version_number) — this preserves the audit trail in the group.
 * See issue #14.
 */
export async function deleteDraftVersion(
  budgetId: string,
  userId?: string
): Promise<void> {
  const { data: target, error: loadErr } = await supabase
    .from("budgets")
    .select("id, status, is_current_version, is_published_version, version_group_id, version_number, public_id, parent_budget_id, change_reason")
    .eq("id", budgetId)
    .single();

  if (loadErr || !target) throw new Error("Versão não encontrada");
  if (target.status !== "draft") throw new Error("Apenas versões em rascunho podem ser excluídas");
  if (target.is_current_version) throw new Error("Não é possível excluir a versão atual");
  if (target.is_published_version) throw new Error("Não é possível excluir uma versão publicada");

  // Find a surviving sibling we can attach the audit event to (any other budget
  // in the same group). Also enforces "not the only version of the group".
  let auditTargetId: string | null = null;
  if (target.version_group_id) {
    const { data: siblings } = await supabase
      .from("budgets")
      .select("id, version_number")
      .eq("version_group_id", target.version_group_id)
      .neq("id", budgetId)
      .order("version_number", { ascending: true })
      .limit(1);

    if (!siblings || siblings.length === 0) {
      throw new Error("Não é possível excluir a única versão do grupo");
    }
    auditTargetId = siblings[0].id;
  }

  // Audit BEFORE deletion: log on a sibling so the event survives the CASCADE.
  if (auditTargetId) {
    await logVersionEvent({
      event_type: "version_deleted",
      budget_id: auditTargetId,
      user_id: userId ?? null,
      metadata: {
        deleted_budget_id: budgetId,
        deleted_version_number: target.version_number,
        deleted_public_id: target.public_id,
        deleted_parent_budget_id: target.parent_budget_id,
        deleted_change_reason: target.change_reason,
        version_group_id: target.version_group_id,
      },
    });
  }

  // Cascade clean-up: items/images via sections, adjustments, rooms, tours.
  const { data: sectionRows } = await supabase
    .from("sections")
    .select("id")
    .eq("budget_id", budgetId);

  const sectionIds = (sectionRows || []).map((s) => s.id);
  if (sectionIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id")
      .in("section_id", sectionIds);
    const itemIds = (itemRows || []).map((i) => i.id);
    if (itemIds.length > 0) {
      await supabase.from("item_images").delete().in("item_id", itemIds);
      await supabase.from("items").delete().in("id", itemIds);
    }
    await supabase.from("sections").delete().in("id", sectionIds);
  }

  await supabase.from("adjustments").delete().eq("budget_id", budgetId);
  await supabase.from("rooms").delete().eq("budget_id", budgetId);
  await supabase.from("budget_tours").delete().eq("budget_id", budgetId);

  const { error: delErr } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (delErr) throw new Error(`Falha ao excluir versão: ${delErr.message}`);
}

/**
 * Set a specific version as the current one.
 * Demotes all others in the group.
 */
export async function setCurrentVersion(budgetId: string, groupId: string, userId?: string) {
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId);

  const { data } = await supabase
    .from("budgets")
    .update({ is_current_version: true })
    .eq("id", budgetId)
    .select("version_number")
    .single();

  await logVersionEvent({
    event_type: "version_activated",
    budget_id: budgetId,
    user_id: userId ?? null,
    metadata: { version_number: data?.version_number ?? "?" },
  });
}

/**
 * Publish a specific version — marks it as the published one.
 * Only one version per group can be published at a time.
 *
 * IMPORTANTE: Se já existir uma versão publicada no grupo, o `public_id` dela é
 * **transferido** para a nova versão para que o link compartilhado com o cliente
 * (ex.: /o/<publicId>) continue funcionando e passe a apontar para o conteúdo
 * mais recente. O `publicId` informado é usado apenas como fallback quando não
 * há versão publicada anterior (primeira publicação do grupo).
 */
export async function publishVersion(budgetId: string, groupId: string, publicId: string, userId?: string) {
  // Encontra QUALQUER versão do grupo que ainda detenha um public_id
  // (não apenas as marcadas com is_published_version=true), para herdar o link
  // e liberar o UNIQUE constraint de public_id antes de publicar a nova versão.
  // Isso cobre cenários onde versões antigas ficaram "órfãs" com status='published'
  // mas is_published_version=false (resíduo de migrações anteriores).
  const { data: prevWithPublicId } = await supabase
    .from("budgets")
    .select("id, version_number, public_id, is_published_version")
    .eq("version_group_id", groupId)
    .neq("id", budgetId)
    .not("public_id", "is", null);

  // O "principal" anterior é a versão marcada como published, ou (fallback) a
  // primeira encontrada com public_id.
  const prevPublished =
    (prevWithPublicId || []).find((p) => p.is_published_version) ||
    (prevWithPublicId || [])[0] ||
    null;

  // Decide qual public_id usar: o da versão anteriormente publicada (preserva o link)
  // ou o fornecido (primeira publicação do grupo).
  const finalPublicId = prevPublished?.public_id || publicId;

  // Step 1: Libera public_id de TODAS as versões antigas do grupo (defesa em profundidade)
  // para evitar conflito do UNIQUE constraint. Marca como arquivadas.
  if (prevWithPublicId && prevWithPublicId.length > 0) {
    const idsToDemote = prevWithPublicId.map((p) => p.id);
    const { error: demoteErr } = await supabase
      .from("budgets")
      .update({ is_published_version: false, status: "archived", public_id: null })
      .in("id", idsToDemote);
    if (demoteErr) throw demoteErr;
  }

  // Step 2: Publica a nova versão herdando o public_id antigo (ou usando o novo).
  // Também renova `date` para hoje, garantindo que a validade (date + validity_days)
  // seja recontada a partir da publicação desta nova versão.
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: published, error: pubErr } = await supabase
    .from("budgets")
    .update({
      is_published_version: true,
      status: "published",
      public_id: finalPublicId,
      date: todayISO,
    })
    .eq("id", budgetId)
    .select("version_number, public_id")
    .single();

  if (pubErr) throw pubErr;

  // Audit: superseded (registra que o link foi transferido para a nova versão)
  if (prevPublished && prevPublished.id !== budgetId) {
    await logVersionEvent({
      event_type: "version_superseded",
      budget_id: prevPublished.id,
      user_id: userId ?? null,
      metadata: {
        version_number: prevPublished.version_number,
        replaced_by: budgetId,
        public_id_transferred: finalPublicId,
      },
    });
  }

  // Audit: published
  await logVersionEvent({
    event_type: "version_published",
    budget_id: budgetId,
    user_id: userId ?? null,
    metadata: {
      version_number: published?.version_number ?? "?",
      public_id: finalPublicId,
      inherited_public_id: Boolean(prevPublished?.public_id),
    },
  });

  return { publicId: finalPublicId };
}

/**
 * Get the currently published version for a group (if any).
 */
export async function getPublishedVersion(groupId: string) {
  const { data } = await supabase
    .from("budgets")
    .select("id, version_number, versao, public_id")
    .eq("version_group_id", groupId)
    .eq("is_published_version", true)
    .limit(1)
    .single();

  return data;
}

/**
 * Compare two versions — returns sections/items from both for side-by-side diff.
 */
export async function loadVersionForComparison(budgetId: string) {
  const { data: sections } = await supabase
    .from("sections")
    .select("id, title, order_index, section_price, qty, items(id, title, description, qty, unit, internal_total, internal_unit_price)")
    .eq("budget_id", budgetId)
    .order("order_index");

  return sections || [];
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

  // 1. Assign the imported budget to this group FIRST (insert/update before demote)
  // to avoid leaving the group without a current version if the second step fails.
  await supabase
    .from("budgets")
    .update({
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: true,
      is_published_version: false,
      parent_budget_id: existingBudgetId,
      versao: `${nextVersion}`,
    })
    .eq("id", newBudgetId);

  // 2. Demote previous current versions (excluding the one we just promoted)
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId)
    .neq("id", newBudgetId);
}
