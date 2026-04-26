-- 1) Expande CHECK de action_type
ALTER TABLE public.ai_bulk_operations
  DROP CONSTRAINT IF EXISTS ai_bulk_operations_action_type_check;

ALTER TABLE public.ai_bulk_operations
  ADD CONSTRAINT ai_bulk_operations_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'financial_adjustment',
    'status_change',
    'assign_owner',
    'priority_change',
    'validity_change',
    'due_date_change',
    'pipeline_change',
    'pipeline_stage_change',
    'archive',
    'update_internal_status',
    'update_pipeline_stage'
  ]));

-- 2) Aceita status 'running'
ALTER TABLE public.ai_bulk_operations
  DROP CONSTRAINT IF EXISTS ai_bulk_operations_status_check;

ALTER TABLE public.ai_bulk_operations
  ADD CONSTRAINT ai_bulk_operations_status_check
  CHECK (status = ANY (ARRAY['pending','running','applied','reverted','failed']));

-- 3) Colunas de progresso
ALTER TABLE public.ai_bulk_operations
  ADD COLUMN IF NOT EXISTS applicable_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heartbeat_at     timestamptz,
  ADD COLUMN IF NOT EXISTS progress_phase   text;

-- 4) RPC: aplica fator em todos os itens (e sections com section_price) de um conjunto de orçamentos
CREATE OR REPLACE FUNCTION public.bulk_apply_factor_to_items(
  p_budget_ids uuid[],
  p_factor numeric
) RETURNS TABLE (
  budgets_updated integer,
  items_updated integer,
  sections_updated integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_items_updated integer := 0;
  v_sections_updated integer := 0;
  v_budgets_updated integer := 0;
BEGIN
  -- Authorization: only admins
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  -- Sanity guard on factor
  IF p_factor IS NULL OR p_factor <= 0 OR p_factor > 10 THEN
    RAISE EXCEPTION 'Invalid factor: must be > 0 and <= 10';
  END IF;

  IF p_budget_ids IS NULL OR array_length(p_budget_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Update items
  WITH upd AS (
    UPDATE public.items i
       SET internal_unit_price = CASE
             WHEN i.internal_unit_price IS NOT NULL THEN ROUND((i.internal_unit_price * p_factor)::numeric, 2)
             ELSE i.internal_unit_price
           END,
           internal_total = CASE
             WHEN i.internal_total IS NOT NULL THEN ROUND((i.internal_total * p_factor)::numeric, 2)
             ELSE i.internal_total
           END
      FROM public.sections s
     WHERE s.id = i.section_id
       AND s.budget_id = ANY (p_budget_ids)
    RETURNING i.id
  )
  SELECT count(*) INTO v_items_updated FROM upd;

  -- Update sections that have a manual section_price
  WITH upd AS (
    UPDATE public.sections s
       SET section_price = ROUND((s.section_price * p_factor)::numeric, 2)
     WHERE s.budget_id = ANY (p_budget_ids)
       AND s.section_price IS NOT NULL
    RETURNING s.id
  )
  SELECT count(*) INTO v_sections_updated FROM upd;

  -- Touch budgets so updated_at advances and downstream caches invalidate
  WITH upd AS (
    UPDATE public.budgets b
       SET updated_at = now(),
           manual_total = CASE
             WHEN b.manual_total IS NOT NULL THEN ROUND((b.manual_total * p_factor)::numeric, 2)
             ELSE b.manual_total
           END
     WHERE b.id = ANY (p_budget_ids)
    RETURNING b.id
  )
  SELECT count(*) INTO v_budgets_updated FROM upd;

  RETURN QUERY SELECT v_budgets_updated, v_items_updated, v_sections_updated;
END;
$$;

-- 5) RPC: contagem rápida de orçamentos elegíveis
CREATE OR REPLACE FUNCTION public.count_eligible_budgets(
  p_internal_statuses text[] DEFAULT NULL,
  p_pipeline_stages   text[] DEFAULT NULL,
  p_created_from      date   DEFAULT NULL,
  p_created_to        date   DEFAULT NULL,
  p_only_current      boolean DEFAULT true
) RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  SELECT count(*)
    INTO v_count
    FROM public.budgets b
   WHERE b.internal_status NOT IN ('contrato_fechado','perdido','lost','archived')
     AND (p_internal_statuses IS NULL OR b.internal_status = ANY (p_internal_statuses))
     AND (p_pipeline_stages   IS NULL OR b.pipeline_stage  = ANY (p_pipeline_stages))
     AND (p_created_from IS NULL OR b.created_at::date >= p_created_from)
     AND (p_created_to   IS NULL OR b.created_at::date <= p_created_to)
     AND (NOT p_only_current OR COALESCE(b.is_current_version, true) = true);

  RETURN v_count;
END;
$$;