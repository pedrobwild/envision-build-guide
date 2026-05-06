-- RPC SECURITY DEFINER que aplica template em qualquer orçamento que o usuário
-- possa acessar (via can_access_budget), evitando que orçamentistas fiquem
-- bloqueados por RLS quando o budget pertence a outro estimator_owner.

CREATE OR REPLACE FUNCTION public.seed_budget_from_template(
  p_budget_id uuid,
  p_template_id uuid  -- pode ser NULL (significa "seções padrão")
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_section_ids uuid[];
  v_new_section_id uuid;
  v_tpl_section RECORD;
  v_sections_created int := 0;
  v_items_created int := 0;
  v_discount_amount numeric := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT public.can_access_budget(v_user, p_budget_id) THEN
    RAISE EXCEPTION 'forbidden: no access to budget %', p_budget_id;
  END IF;

  -- 1) Limpa seções e itens existentes do orçamento
  SELECT array_agg(id) INTO v_section_ids FROM public.sections WHERE budget_id = p_budget_id;
  IF v_section_ids IS NOT NULL AND array_length(v_section_ids, 1) > 0 THEN
    DELETE FROM public.items WHERE section_id = ANY(v_section_ids);
    DELETE FROM public.sections WHERE budget_id = p_budget_id;
  END IF;

  -- 2) Sem template → o app aplica as "seções padrão" via TS (default-budget-sections).
  --    Aqui só limpamos. O cliente continua a chamar seedDefaultSections quando p_template_id é null.
  IF p_template_id IS NULL THEN
    RETURN jsonb_build_object('cleared', true, 'sections_created', 0, 'items_created', 0);
  END IF;

  -- 3) Lê desconto promocional do template
  SELECT COALESCE(default_discount_amount, 0) INTO v_discount_amount
  FROM public.budget_templates
  WHERE id = p_template_id;

  -- 4) Loop pelas seções do template, copiando para o budget
  FOR v_tpl_section IN
    SELECT id, title, subtitle, order_index, notes, tags, included_bullets, excluded_bullets, is_optional
    FROM public.budget_template_sections
    WHERE template_id = p_template_id
    ORDER BY order_index
  LOOP
    INSERT INTO public.sections (
      budget_id, title, subtitle, order_index, notes, tags,
      included_bullets, excluded_bullets, is_optional
    ) VALUES (
      p_budget_id,
      v_tpl_section.title,
      v_tpl_section.subtitle,
      v_tpl_section.order_index,
      v_tpl_section.notes,
      COALESCE(v_tpl_section.tags, '[]'::jsonb),
      COALESCE(v_tpl_section.included_bullets, '[]'::jsonb),
      COALESCE(v_tpl_section.excluded_bullets, '[]'::jsonb),
      COALESCE(v_tpl_section.is_optional, false)
    )
    RETURNING id INTO v_new_section_id;

    v_sections_created := v_sections_created + 1;

    INSERT INTO public.items (
      section_id, title, description, unit, qty, order_index,
      coverage_type, reference_url, internal_unit_price, internal_total, bdi_percentage
    )
    SELECT
      v_new_section_id, ti.title, ti.description, ti.unit, ti.qty, ti.order_index,
      COALESCE(ti.coverage_type, 'geral'), ti.reference_url,
      ti.internal_unit_price, ti.internal_total, COALESCE(ti.bdi_percentage, 0)
    FROM public.budget_template_items ti
    WHERE ti.template_section_id = v_tpl_section.id
    ORDER BY ti.order_index;

    GET DIAGNOSTICS v_items_created = ROW_COUNT;
  END LOOP;

  -- 5) Desconto promocional automático
  IF v_discount_amount > 0 THEN
    INSERT INTO public.sections (budget_id, title, subtitle, order_index)
    VALUES (p_budget_id, 'Descontos', 'Aplicado sobre o subtotal do projeto', v_sections_created)
    RETURNING id INTO v_new_section_id;

    INSERT INTO public.items (
      section_id, title, qty, internal_unit_price, bdi_percentage, order_index, coverage_type
    ) VALUES (
      v_new_section_id, 'Desconto promocional', 1, -v_discount_amount, 0, 0, 'geral'
    );
  END IF;

  RETURN jsonb_build_object(
    'cleared', true,
    'sections_created', v_sections_created,
    'discount_applied', v_discount_amount > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_budget_from_template(uuid, uuid) TO authenticated;