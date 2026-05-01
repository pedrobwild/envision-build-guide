-- 1) Coluna soft-delete
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_budgets_deleted_at
  ON public.budgets (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 2) RLS: ocultar soft-deleted das policies de SELECT (exceto admin, que precisa para a lixeira)
DROP POLICY IF EXISTS "Anon can view published budgets" ON public.budgets;
CREATE POLICY "Anon can view published budgets"
  ON public.budgets FOR SELECT
  USING (
    status = ANY (ARRAY['published','minuta_solicitada'])
    AND public_id IS NOT NULL
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Authenticated can view published budgets" ON public.budgets;
CREATE POLICY "Authenticated can view published budgets"
  ON public.budgets FOR SELECT
  USING (
    status = ANY (ARRAY['published','minuta_solicitada'])
    AND public_id IS NOT NULL
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Comercial can view assigned budgets" ON public.budgets;
CREATE POLICY "Comercial can view assigned budgets"
  ON public.budgets FOR SELECT
  USING (commercial_owner_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Orcamentista can view any budget" ON public.budgets;
CREATE POLICY "Orcamentista can view any budget"
  ON public.budgets FOR SELECT
  USING (has_role(auth.uid(), 'orcamentista'::app_role) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Orcamentista can view assigned budgets" ON public.budgets;
CREATE POLICY "Orcamentista can view assigned budgets"
  ON public.budgets FOR SELECT
  USING (estimator_owner_id = auth.uid() AND deleted_at IS NULL);

-- Admin policy continua "ALL" sem filtro de deleted_at, então admin vê tudo (inclui lixeira) — necessário para restaurar.
-- A UI normal de admin vai filtrar deleted_at IS NULL no client; a página de Lixeira usa RPC dedicado.

-- 3) RPCs de lixeira
CREATE OR REPLACE FUNCTION public.list_deleted_budgets(p_limit int DEFAULT 200)
RETURNS TABLE (
  id uuid,
  sequential_code text,
  client_name text,
  project_name text,
  internal_status text,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.sequential_code, b.client_name, b.project_name,
         b.internal_status, b.deleted_at, b.deleted_by, b.created_at
  FROM public.budgets b
  WHERE b.deleted_at IS NOT NULL
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY b.deleted_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$$;

CREATE OR REPLACE FUNCTION public.restore_budget(p_budget_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  UPDATE public.budgets
     SET deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
   WHERE id = p_budget_id
     AND deleted_at IS NOT NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado na lixeira';
  END IF;

  INSERT INTO public.budget_events (budget_id, event_type, note, user_id, created_at)
  VALUES (v_id, 'budget_restored', 'Orçamento restaurado da lixeira', auth.uid(), now());

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_budget(p_budget_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  -- Só permite purge definitivo se já estiver na lixeira
  IF NOT EXISTS (
    SELECT 1 FROM public.budgets WHERE id = p_budget_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Orçamento não está na lixeira';
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

GRANT EXECUTE ON FUNCTION public.list_deleted_budgets(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_budget(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_budget(uuid) TO authenticated;