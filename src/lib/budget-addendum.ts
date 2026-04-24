import { supabase } from "@/integrations/supabase/client";
import { logVersionEvent } from "@/lib/version-audit";
import { ensureVersionGroup } from "@/lib/budget-versioning";

/**
 * Aditivo Contratual.
 *
 * Modelo: ao criar um aditivo a partir de um orçamento já enviado/publicado,
 * geramos uma NOVA VERSÃO no mesmo version_group_id, marcada com
 * `is_addendum=true`. Todos os itens/seções herdados do orçamento base são
 * copiados com `addendum_action=NULL` (inalterados). O usuário marca
 * itens/seções para REMOVER (`addendum_action='remove'` — subtrai do total)
 * ou ADICIONA novos (`addendum_action='add'` — soma ao total).
 *
 * Ao publicar, `publishVersion` transfere o `public_id` da versão anterior
 * para o aditivo (mesmo link p/ cliente).
 */
export async function createAddendumFromBudget(
  sourceBudgetId: string,
  userId: string
): Promise<string> {
  const groupId = await ensureVersionGroup(sourceBudgetId);

  // 1. Próximo número de versão e número do aditivo
  const { data: groupRows } = await supabase
    .from("budgets")
    .select("version_number, is_addendum, addendum_number")
    .eq("version_group_id", groupId);

  const nextVersion =
    Math.max(0, ...((groupRows ?? []).map((r) => r.version_number ?? 0))) + 1;
  const nextAddendumNumber =
    Math.max(
      0,
      ...((groupRows ?? [])
        .filter((r) => r.is_addendum)
        .map((r) => r.addendum_number ?? 0))
    ) + 1;

  // 2. Carrega o orçamento fonte
  const { data: source, error: srcErr } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", sourceBudgetId)
    .single();
  if (srcErr || !source) throw new Error("Orçamento fonte não encontrado");

  // Strip de campos auto/únicos antes do insert (mesmo padrão de duplicateBudgetAsVersion)
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    public_id: _pid,
    public_token_hash: _pth,
    view_count: _vc,
    last_viewed_at: _lva,
    approved_at: _aa,
    approved_by_name: _abn,
    generated_at: _ga,
    is_published_version: _ipv,
    sequential_code: _sc,
    closed_at: _cla,
    contract_file_url: _cfu,
    budget_pdf_url: _bpu,
    version_group_id: _vgid,
    version_number: _vnum,
    is_current_version: _icv,
    parent_budget_id: _pbid,
    change_reason: _cr,
    status: _st,
    created_by: _cb,
    is_addendum: _ia,
    addendum_number: _an,
    addendum_base_budget_id: _abbid,
    addendum_approved_at: _adaa,
    addendum_approved_by_name: _adabn,
    addendum_summary: _ads,
    ...meta
  } = source as Record<string, unknown>;

  // 3. Cria o orçamento-aditivo (rascunho)
  const { data: newBudget, error: insertErr } = await supabase
    .from("budgets")
    .insert({
      ...meta,
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: false, // promovemos depois
      is_published_version: false,
      parent_budget_id: sourceBudgetId,
      change_reason: `Aditivo Nº ${nextAddendumNumber}`,
      versao: `${nextVersion} (Aditivo ${nextAddendumNumber})`,
      status: "draft",
      created_by: userId,
      view_count: 0,
      is_addendum: true,
      addendum_number: nextAddendumNumber,
      addendum_base_budget_id: sourceBudgetId,
    })
    .select("id")
    .single();
  if (insertErr || !newBudget)
    throw insertErr || new Error("Falha ao criar aditivo");

  // 4. Promove novo como current
  await supabase
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId)
    .neq("id", newBudget.id);
  await supabase
    .from("budgets")
    .update({ is_current_version: true })
    .eq("id", newBudget.id);

  // 5. Clona seções com addendum_action=NULL (herdadas, inalteradas)
  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("budget_id", sourceBudgetId)
    .order("order_index");

  if (sections && sections.length > 0) {
    const sectionInserts = sections.map(
      ({ id: _sid, created_at: _sca, budget_id: _sbid, ...rest }) => ({
        ...rest,
        budget_id: newBudget.id,
        addendum_action: null,
      })
    );
    const { data: newSections } = await supabase
      .from("sections")
      .insert(sectionInserts)
      .select();

    if (newSections && newSections.length > 0) {
      const sectionIdMap = new Map<string, string>();
      sections.forEach((s, i) => {
        if (newSections[i]) sectionIdMap.set(s.id, newSections[i].id);
      });

      const oldSectionIds = sections.map((s) => s.id);
      const { data: allItems } = await supabase
        .from("items")
        .select("*")
        .in("section_id", oldSectionIds)
        .order("order_index");

      if (allItems && allItems.length > 0) {
        const itemInserts = allItems.map(
          ({ id: _iid, created_at: _ica, section_id, ...rest }) => ({
            ...rest,
            section_id: sectionIdMap.get(section_id) || section_id,
            addendum_action: null,
          })
        );
        const { data: newItems } = await supabase
          .from("items")
          .insert(itemInserts)
          .select();

        if (newItems && newItems.length > 0) {
          const itemIdMap = new Map<string, string>();
          allItems.forEach((it, i) => {
            if (newItems[i]) itemIdMap.set(it.id, newItems[i].id);
          });

          const oldItemIds = allItems.map((it) => it.id);
          const { data: allImages } = await supabase
            .from("item_images")
            .select("*")
            .in("item_id", oldItemIds);

          if (allImages && allImages.length > 0) {
            const imageInserts = allImages.map(
              ({ id: _imid, created_at: _imca, item_id, ...rest }) => ({
                ...rest,
                item_id: itemIdMap.get(item_id) || item_id,
              })
            );
            await supabase.from("item_images").insert(imageInserts);
          }
        }
      }
    }
  }

  // 6. Clona adjustments
  const { data: adjustments } = await supabase
    .from("adjustments")
    .select("*")
    .eq("budget_id", sourceBudgetId);
  if (adjustments && adjustments.length > 0) {
    await supabase.from("adjustments").insert(
      adjustments.map(
        ({ id: _aid, created_at: _aca, budget_id: _abid, ...rest }) => ({
          ...rest,
          budget_id: newBudget.id,
        })
      )
    );
  }

  // 7. Clona rooms e tours (mídias mantêm public_id antigo até publicação)
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .eq("budget_id", sourceBudgetId);
  if (rooms && rooms.length > 0) {
    await supabase.from("rooms").insert(
      rooms.map(
        ({ id: _rid, created_at: _rca, budget_id: _rbid, ...rest }) => ({
          ...rest,
          budget_id: newBudget.id,
        })
      )
    );
  }

  const { data: tours } = await supabase
    .from("budget_tours")
    .select("*")
    .eq("budget_id", sourceBudgetId);
  if (tours && tours.length > 0) {
    await supabase.from("budget_tours").insert(
      tours.map(
        ({ id: _tid, created_at: _tca, budget_id: _tbid, ...rest }) => ({
          ...rest,
          budget_id: newBudget.id,
        })
      )
    );
  }

  // 8. Audit
  await logVersionEvent({
    event_type: "addendum_created",
    budget_id: newBudget.id,
    user_id: userId,
    metadata: {
      addendum_number: nextAddendumNumber,
      base_budget_id: sourceBudgetId,
      version_number: nextVersion,
    },
  });

  return newBudget.id;
}
