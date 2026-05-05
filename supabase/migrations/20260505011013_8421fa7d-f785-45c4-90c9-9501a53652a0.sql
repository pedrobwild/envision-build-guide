CREATE OR REPLACE FUNCTION public.get_public_budget_full(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_budget_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_budget_id
    FROM public.budgets
   WHERE public_id = p_public_id
     AND status = ANY (ARRAY['published','minuta_solicitada'])
     AND public_id IS NOT NULL
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_budget_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'budget', (
      SELECT jsonb_build_object(
        'id', b.id,
        'project_name', b.project_name,
        'client_name', b.client_name,
        'condominio', b.condominio,
        'bairro', COALESCE(NULLIF(p.bairro, ''), b.bairro),
        'metragem', COALESCE(NULLIF(p.metragem, ''), b.metragem),
        'unit', b.unit,
        'date', b.date,
        'validity_days', b.validity_days,
        'prazo_dias_uteis', b.prazo_dias_uteis,
        'estimated_weeks', b.estimated_weeks,
        'versao', b.versao,
        'version_number', b.version_number,
        'consultora_comercial', b.consultora_comercial,
        'email_comercial', b.email_comercial,
        'status', b.status,
        'public_id', b.public_id,
        'show_item_qty', b.show_item_qty,
        'show_item_prices', b.show_item_prices,
        'show_progress_bars', b.show_progress_bars,
        'show_optional_items', b.show_optional_items,
        'generated_at', b.generated_at,
        'disclaimer', b.disclaimer,
        'notes', b.notes,
        'floor_plan_url', COALESCE(p.floor_plan_url, b.floor_plan_url),
        'view_count', b.view_count,
        'approved_at', b.approved_at,
        'approved_by_name', b.approved_by_name,
        'lead_email', b.lead_email,
        'lead_name', b.lead_name,
        'header_config', b.header_config,
        'budget_pdf_url', b.budget_pdf_url,
        'manual_total', b.manual_total,
        'is_addendum', b.is_addendum,
        'addendum_number', b.addendum_number,
        'addendum_summary', b.addendum_summary,
        'addendum_approved_at', b.addendum_approved_at,
        'addendum_approved_by_name', b.addendum_approved_by_name
      )
        FROM public.budgets b
        LEFT JOIN public.client_properties p ON p.id = b.property_id
       WHERE b.id = v_budget_id
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'budget_id', s.budget_id,
        'title', s.title,
        'subtitle', s.subtitle,
        'order_index', s.order_index,
        'qty', s.qty,
        'section_price', s.section_price,
        'cover_image_url', s.cover_image_url,
        'tags', s.tags,
        'included_bullets', s.included_bullets,
        'excluded_bullets', s.excluded_bullets,
        'notes', s.notes,
        'is_optional', s.is_optional,
        'addendum_action', s.addendum_action
      ) ORDER BY s.order_index)
        FROM public.sections s
       WHERE s.budget_id = v_budget_id
    ), '[]'::jsonb),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'section_id', i.section_id,
        'title', i.title,
        'description', i.description,
        'order_index', i.order_index,
        'qty', i.qty,
        'unit', i.unit,
        'coverage_type', i.coverage_type,
        'included_rooms', i.included_rooms,
        'excluded_rooms', i.excluded_rooms,
        'internal_unit_price', i.internal_unit_price,
        'internal_total', i.internal_total,
        'bdi_percentage', i.bdi_percentage,
        'addendum_action', i.addendum_action
      ) ORDER BY i.order_index)
        FROM public.items i
        JOIN public.sections s ON s.id = i.section_id
       WHERE s.budget_id = v_budget_id
    ), '[]'::jsonb),
    'adjustments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'budget_id', a.budget_id,
        'label', a.label,
        'amount', a.amount,
        'sign', a.sign
      ))
        FROM public.adjustments a
       WHERE a.budget_id = v_budget_id
    ), '[]'::jsonb),
    'rooms', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'polygon', r.polygon
      ) ORDER BY r.order_index)
        FROM public.rooms r
       WHERE r.budget_id = v_budget_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_budget_full(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_budget_full(text) TO anon, authenticated;