-- Permitir que qualquer orçamentista edite qualquer orçamento (e suas seções/itens),
-- não apenas os atribuídos a ele.

-- BUDGETS: liberar UPDATE para todos com role 'orcamentista'
DROP POLICY IF EXISTS "Orcamentista can update unassigned budgets" ON public.budgets;
DROP POLICY IF EXISTS "Orcamentista can update any budget" ON public.budgets;
CREATE POLICY "Orcamentista can update any budget"
  ON public.budgets
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));

-- BUDGETS: liberar SELECT também para todos os orçamentistas
DROP POLICY IF EXISTS "Orcamentista can view unassigned budgets" ON public.budgets;
DROP POLICY IF EXISTS "Orcamentista can view any budget" ON public.budgets;
CREATE POLICY "Orcamentista can view any budget"
  ON public.budgets
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'));

-- can_access_budget já contempla admin/owner. Atualizar para considerar orçamentista global.
CREATE OR REPLACE FUNCTION public.can_access_budget(_user_id uuid, _budget_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.budgets
    WHERE id = _budget_id
    AND (
      created_by = _user_id
      OR commercial_owner_id = _user_id
      OR estimator_owner_id = _user_id
      OR public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'orcamentista')
    )
  )
$function$;