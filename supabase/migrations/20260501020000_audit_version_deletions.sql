-- =============================================================================
-- Audit obrigatória em paths de hard-delete de orçamentos
-- Issue: https://github.com/pedrobwild/envision-build-guide/issues/14
--
-- `budget_events.budget_id` tem ON DELETE CASCADE, então qualquer evento
-- registrado no próprio budget que está sendo apagado é destruído junto.
-- Para preservar a trilha de auditoria, qualquer hard-delete passa a logar
-- um evento em um IRMÃO do mesmo `version_group_id` (ou no parent), antes
-- da remoção física.
--
-- Esta migration cobre o path de servidor (`purge_budget`). O path de cliente
-- (`deleteDraftVersion` em `src/lib/budget-versioning.ts`) é coberto na PR
-- correspondente: ele agora chama `logVersionEvent({ event_type:
-- 'version_deleted', budget_id: <irmão>, ... })` antes do DELETE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.purge_budget(p_budget_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_target uuid;
  v_target record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  -- Só permite purge definitivo se já estiver na lixeira
  SELECT id, version_group_id, version_number, parent_budget_id,
         is_current_version, is_published_version, public_id, status,
         project_name, client_name, deleted_at, deleted_by
    INTO v_target
    FROM public.budgets
   WHERE id = p_budget_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não está na lixeira';
  END IF;

  -- Escolhe um budget que SOBREVIVERÁ ao purge para receber o evento de auditoria.
  -- Preferência: irmão de menor version_number no mesmo grupo; se não houver
  -- (purge da única versão de um grupo), tenta o parent_budget_id; se nem isso,
  -- não há onde registrar (auditoria fica como warning silencioso).
  IF v_target.version_group_id IS NOT NULL THEN
    SELECT id INTO v_audit_target
      FROM public.budgets
     WHERE version_group_id = v_target.version_group_id
       AND id <> p_budget_id
     ORDER BY version_number ASC NULLS LAST, created_at ASC
     LIMIT 1;
  END IF;

  IF v_audit_target IS NULL AND v_target.parent_budget_id IS NOT NULL THEN
    -- parent_budget_id já tem FK ON DELETE SET NULL (issue #15), então pode ser
    -- NULL aqui se o parent foi removido antes. Verifica existência:
    SELECT id INTO v_audit_target
      FROM public.budgets
     WHERE id = v_target.parent_budget_id;
  END IF;

  IF v_audit_target IS NOT NULL THEN
    INSERT INTO public.budget_events (
      budget_id, event_type, note, user_id, metadata, created_at
    ) VALUES (
      v_audit_target,
      'budget_purged',
      'Orçamento removido definitivamente da lixeira (purge)',
      auth.uid(),
      jsonb_build_object(
        'purged_budget_id', p_budget_id,
        'purged_version_number', v_target.version_number,
        'purged_public_id', v_target.public_id,
        'purged_parent_budget_id', v_target.parent_budget_id,
        'purged_status', v_target.status,
        'was_current_version', v_target.is_current_version,
        'was_published_version', v_target.is_published_version,
        'project_name', v_target.project_name,
        'client_name', v_target.client_name,
        'deleted_at', v_target.deleted_at,
        'deleted_by', v_target.deleted_by,
        'version_group_id', v_target.version_group_id
      ),
      now()
    );
  END IF;

  -- Cascata manual (mesma ordem do safeDeleteBudget)
  DELETE FROM public.item_images WHERE item_id IN (
    SELECT i.id FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
     WHERE s.budget_id = p_budget_id
  );
  DELETE FROM public.items WHERE section_id IN (
    SELECT id FROM public.sections WHERE budget_id = p_budget_id
  );
  DELETE FROM public.sections WHERE budget_id = p_budget_id;
  DELETE FROM public.adjustments WHERE budget_id = p_budget_id;
  DELETE FROM public.rooms WHERE budget_id = p_budget_id;
  DELETE FROM public.budget_tours WHERE budget_id = p_budget_id;
  DELETE FROM public.budgets WHERE id = p_budget_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_budget(uuid) TO authenticated;
