-- Single round-trip RPC for the public budget page.
-- Returns budget core + sections + items + adjustments + rooms as one JSONB,
-- so the public page can render consistently without 3-4 sequential queries
-- that can momentarily show wrong subtotals.
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
      SELECT to_jsonb(b) - 'briefing' - 'demand_context' - 'internal_notes'
             - 'reference_links' - 'internal_status' - 'priority' - 'due_at'
             - 'closed_at' - 'created_by' - 'commercial_owner_id'
             - 'estimator_owner_id' - 'internal_cost' - 'public_token_hash'
             - 'property_type' - 'city' - 'deleted_at'
        FROM public.budgets b
       WHERE b.id = v_budget_id
    ),
    'sections', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.order_index)
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
      SELECT jsonb_agg(to_jsonb(a))
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