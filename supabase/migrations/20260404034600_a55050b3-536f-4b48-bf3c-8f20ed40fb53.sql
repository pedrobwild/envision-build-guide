
-- 1. Remove the overly-broad public UPDATE policy on budgets
DROP POLICY IF EXISTS "Public can update published budgets" ON public.budgets;

-- 2. Remove the anon SELECT policy on budget_optional_selections (public page doesn't need it)
DROP POLICY IF EXISTS "Anon can view optional selections on published budgets" ON public.budget_optional_selections;

-- 3. Add admin access to optional selections
CREATE POLICY "Admins can manage optional selections"
ON public.budget_optional_selections
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
