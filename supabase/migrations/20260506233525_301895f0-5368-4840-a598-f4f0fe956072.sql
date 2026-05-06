-- Bug 2 fix: Consolidar policies de sections/items via can_access_budget
-- Garante paridade total entre admin, orcamentista e comercial (Política Bwild)

BEGIN;

-- 1. Atualizar can_access_budget para incluir role 'comercial'
CREATE OR REPLACE FUNCTION public.can_access_budget(_user_id uuid, _budget_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM budgets b
    WHERE b.id = _budget_id
      AND (
        b.created_by = _user_id
        OR b.commercial_owner_id = _user_id
        OR b.estimator_owner_id = _user_id
        OR has_role(_user_id, 'admin'::app_role)
        OR has_role(_user_id, 'orcamentista'::app_role)
        OR has_role(_user_id, 'comercial'::app_role)
      )
  );
$$;

-- 2. Sections: drop policies redundantes
DROP POLICY IF EXISTS "Assigned users can view sections" ON public.sections;
DROP POLICY IF EXISTS "Comercial can manage sections of assigned budgets" ON public.sections;
DROP POLICY IF EXISTS "Orcamentista can manage sections on accessible budgets" ON public.sections;
DROP POLICY IF EXISTS "Users manage sections via budget ownership" ON public.sections;

CREATE POLICY "Auth users access sections via can_access_budget"
ON public.sections
FOR ALL TO authenticated
USING (public.can_access_budget(auth.uid(), budget_id))
WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

-- 3. Items: drop policies redundantes
DROP POLICY IF EXISTS "Assigned users can view items" ON public.items;
DROP POLICY IF EXISTS "Comercial can manage items of assigned budgets" ON public.items;
DROP POLICY IF EXISTS "Orcamentista can manage items on accessible budgets" ON public.items;
DROP POLICY IF EXISTS "Users manage items via budget ownership" ON public.items;

CREATE POLICY "Auth users access items via can_access_budget"
ON public.items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = items.section_id
      AND public.can_access_budget(auth.uid(), s.budget_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sections s
    WHERE s.id = items.section_id
      AND public.can_access_budget(auth.uid(), s.budget_id)
  )
);

COMMIT;