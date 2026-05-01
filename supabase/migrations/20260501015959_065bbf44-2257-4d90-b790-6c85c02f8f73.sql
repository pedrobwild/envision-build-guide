-- Função de auto-teste das proteções de orçamento publicado.
-- Roda cada tentativa em SAVEPOINT individual e desfaz, retornando o veredicto.
-- Apenas admin pode executar.

CREATE OR REPLACE FUNCTION public.test_published_budget_immutability()
RETURNS TABLE(test_name text, expected text, actual text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_id uuid;
  v_section_id uuid;
  v_item_id uuid;
  v_draft_id uuid;
  v_err text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  SELECT id INTO v_budget_id
    FROM public.budgets
   WHERE is_published_version = true AND deleted_at IS NULL
   LIMIT 1;

  IF v_budget_id IS NULL THEN
    RETURN QUERY SELECT 'setup'::text, 'published budget exists'::text,
                        'none'::text, false, 'No published budget available to test'::text;
    RETURN;
  END IF;

  SELECT id INTO v_section_id FROM public.sections WHERE budget_id = v_budget_id LIMIT 1;
  IF v_section_id IS NOT NULL THEN
    SELECT id INTO v_item_id FROM public.items WHERE section_id = v_section_id LIMIT 1;
  END IF;

  -- 1) UPDATE de campo proibido em budget publicado deve FALHAR
  BEGIN
    BEGIN
      UPDATE public.budgets SET manual_total = COALESCE(manual_total,0) + 1
       WHERE id = v_budget_id;
      RETURN QUERY SELECT 'budget_update_manual_total'::text, 'blocked'::text,
                          'allowed'::text, false, 'Trigger não bloqueou UPDATE de manual_total'::text;
    EXCEPTION WHEN check_violation THEN
      v_err := SQLERRM;
      RETURN QUERY SELECT 'budget_update_manual_total'::text, 'blocked'::text,
                          'blocked'::text, true, v_err;
    END;
  END;

  -- 2) UPDATE de view_count em publicado deve PASSAR
  BEGIN
    BEGIN
      UPDATE public.budgets SET view_count = COALESCE(view_count,0)
       WHERE id = v_budget_id;
      RETURN QUERY SELECT 'budget_update_view_count'::text, 'allowed'::text,
                          'allowed'::text, true, 'OK'::text;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      RETURN QUERY SELECT 'budget_update_view_count'::text, 'allowed'::text,
                          'blocked'::text, false, v_err;
    END;
  END;

  -- 3) UPDATE em section deve FALHAR
  IF v_section_id IS NOT NULL THEN
    BEGIN
      BEGIN
        UPDATE public.sections SET section_price = COALESCE(section_price,0)
         WHERE id = v_section_id;
        RETURN QUERY SELECT 'section_update'::text, 'blocked'::text,
                            'allowed'::text, false, 'Trigger não bloqueou UPDATE em section'::text;
      EXCEPTION WHEN check_violation THEN
        v_err := SQLERRM;
        RETURN QUERY SELECT 'section_update'::text, 'blocked'::text,
                            'blocked'::text, true, v_err;
      END;
    END;

    -- 4) INSERT em sections de publicado deve FALHAR
    BEGIN
      BEGIN
        INSERT INTO public.sections (budget_id, title) VALUES (v_budget_id, '__test_should_fail__');
        RETURN QUERY SELECT 'section_insert'::text, 'blocked'::text,
                            'allowed'::text, false, 'Trigger não bloqueou INSERT em section'::text;
      EXCEPTION WHEN check_violation THEN
        v_err := SQLERRM;
        RETURN QUERY SELECT 'section_insert'::text, 'blocked'::text,
                            'blocked'::text, true, v_err;
      END;
    END;
  END IF;

  -- 5) UPDATE em item deve FALHAR
  IF v_item_id IS NOT NULL THEN
    BEGIN
      BEGIN
        UPDATE public.items SET internal_total = COALESCE(internal_total,0)
         WHERE id = v_item_id;
        RETURN QUERY SELECT 'item_update'::text, 'blocked'::text,
                            'allowed'::text, false, 'Trigger não bloqueou UPDATE em item'::text;
      EXCEPTION WHEN check_violation THEN
        v_err := SQLERRM;
        RETURN QUERY SELECT 'item_update'::text, 'blocked'::text,
                            'blocked'::text, true, v_err;
      END;
    END;

    -- 6) DELETE em item deve FALHAR
    BEGIN
      BEGIN
        DELETE FROM public.items WHERE id = v_item_id;
        RETURN QUERY SELECT 'item_delete'::text, 'blocked'::text,
                            'allowed'::text, false, 'Trigger não bloqueou DELETE em item'::text;
      EXCEPTION WHEN check_violation THEN
        v_err := SQLERRM;
        RETURN QUERY SELECT 'item_delete'::text, 'blocked'::text,
                            'blocked'::text, true, v_err;
      END;
    END;
  END IF;

  -- 7) Soft-delete (deleted_at) idempotente deve PASSAR
  BEGIN
    BEGIN
      UPDATE public.budgets SET deleted_at = deleted_at WHERE id = v_budget_id;
      RETURN QUERY SELECT 'budget_soft_delete_passthrough'::text, 'allowed'::text,
                          'allowed'::text, true, 'OK'::text;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      RETURN QUERY SELECT 'budget_soft_delete_passthrough'::text, 'allowed'::text,
                          'blocked'::text, false, v_err;
    END;
  END;

  -- 8) Draft deve permitir UPDATE normalmente
  SELECT id INTO v_draft_id FROM public.budgets
   WHERE COALESCE(is_published_version,false)=false
     AND deleted_at IS NULL
   LIMIT 1;
  IF v_draft_id IS NOT NULL THEN
    BEGIN
      BEGIN
        UPDATE public.budgets SET manual_total = manual_total WHERE id = v_draft_id;
        RETURN QUERY SELECT 'draft_update_allowed'::text, 'allowed'::text,
                            'allowed'::text, true, 'OK'::text;
      EXCEPTION WHEN OTHERS THEN
        v_err := SQLERRM;
        RETURN QUERY SELECT 'draft_update_allowed'::text, 'allowed'::text,
                            'blocked'::text, false, v_err;
      END;
    END;
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.test_published_budget_immutability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_published_budget_immutability() TO authenticated;
