CREATE OR REPLACE FUNCTION public.find_budget_by_id_prefix(p_prefix text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_id uuid;
  v_count int;
BEGIN
  IF p_prefix IS NULL THEN RETURN NULL; END IF;
  -- mantém apenas hex e hífens
  v_clean := lower(regexp_replace(p_prefix, '[^0-9a-fA-F-]', '', 'g'));
  IF length(v_clean) < 8 THEN RETURN NULL; END IF;

  SELECT id, count(*) OVER () INTO v_id, v_count
  FROM public.budgets
  WHERE id::text LIKE v_clean || '%'
    AND deleted_at IS NULL
    AND public.can_access_budget(id)
  LIMIT 2;

  IF v_count = 1 THEN RETURN v_id; END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_budget_by_id_prefix(text) TO authenticated;