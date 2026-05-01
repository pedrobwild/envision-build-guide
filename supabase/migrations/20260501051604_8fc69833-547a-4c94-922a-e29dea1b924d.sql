-- Authoritative server-side total for the public budget page.
-- Mirrors the client-side rule: prefer manual_total; otherwise compute from
-- items (qty * internal_unit_price * (1+BDI/100), with internal_total fallback)
-- minus addendum-removed lines, plus adjustments.
CREATE OR REPLACE FUNCTION public.get_public_budget_total(p_public_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_budget RECORD;
  v_sections_total numeric := 0;
  v_removed_total numeric := 0;
  v_adjustments_total numeric := 0;
  v_section_count integer := 0;
  v_item_count integer := 0;
  v_total numeric := 0;
  v_source text := 'computed';
BEGIN
  SELECT id, manual_total
    INTO v_budget
    FROM public.budgets
   WHERE public_id = p_public_id
     AND status = ANY (ARRAY['published','minuta_solicitada'])
     AND public_id IS NOT NULL
   LIMIT 1;

  IF v_budget.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_section_count
    FROM public.sections s
   WHERE s.budget_id = v_budget.id
     AND COALESCE(s.addendum_action, '') <> 'remove';

  -- Items value (qty × unit_price × (1+BDI/100), with internal_total fallback)
  -- Skips items removed by an addendum (handled separately).
  WITH visible AS (
    SELECT i.id, i.qty, i.internal_unit_price, i.internal_total,
           COALESCE(i.bdi_percentage, 0) AS bdi,
           COALESCE(s.qty, 1) AS section_qty
      FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
     WHERE s.budget_id = v_budget.id
       AND COALESCE(s.addendum_action, '') <> 'remove'
       AND COALESCE(i.addendum_action, '') <> 'remove'
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(
      CASE
        WHEN COALESCE(internal_unit_price, 0) <> 0 THEN
          internal_unit_price
            * (1 + bdi / 100.0)
            * COALESCE(NULLIF(qty, 0), CASE WHEN internal_unit_price <> 0 THEN 1 ELSE 0 END)
            * section_qty
        WHEN COALESCE(internal_total, 0) <> 0 THEN
          internal_total
            * (1 + bdi / 100.0)
            * COALESCE(qty, 1)
            * section_qty
        ELSE 0
      END
    ), 0)
    INTO v_item_count, v_sections_total
    FROM visible;

  -- Sections without items but with a manual section_price
  SELECT v_sections_total + COALESCE(SUM(s.section_price * COALESCE(s.qty, 1)), 0)
    INTO v_sections_total
    FROM public.sections s
   WHERE s.budget_id = v_budget.id
     AND COALESCE(s.addendum_action, '') <> 'remove'
     AND s.section_price IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.items i
        WHERE i.section_id = s.id
          AND COALESCE(i.addendum_action, '') <> 'remove'
     );

  -- Items removed by an addendum (subtract their original value)
  WITH removed AS (
    SELECT i.qty, i.internal_unit_price, i.internal_total,
           COALESCE(i.bdi_percentage, 0) AS bdi,
           COALESCE(s.qty, 1) AS section_qty
      FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
     WHERE s.budget_id = v_budget.id
       AND (
         s.addendum_action = 'remove'
         OR i.addendum_action = 'remove'
       )
  )
  SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(internal_unit_price, 0) > 0 THEN
          internal_unit_price
            * (1 + bdi / 100.0)
            * COALESCE(NULLIF(qty, 0), 1)
            * section_qty
        WHEN COALESCE(internal_total, 0) > 0 THEN
          internal_total
            * (1 + bdi / 100.0)
            * COALESCE(qty, 1)
            * section_qty
        ELSE 0
      END
    ), 0)
    INTO v_removed_total
    FROM removed;

  -- Adjustments
  SELECT COALESCE(SUM(a.sign * a.amount), 0)
    INTO v_adjustments_total
    FROM public.adjustments a
   WHERE a.budget_id = v_budget.id;

  IF v_budget.manual_total IS NOT NULL THEN
    v_total := v_budget.manual_total;
    v_source := 'manual';
  ELSE
    v_total := v_sections_total - v_removed_total + v_adjustments_total;
    v_source := 'computed';
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'source', v_source,
    'section_count', v_section_count,
    'item_count', v_item_count,
    'has_manual_total', v_budget.manual_total IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_budget_total(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_budget_total(text) TO anon, authenticated;