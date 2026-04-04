
-- Fix 1: Add admin ALL policy for budget_tours (consistency with other tables)
CREATE POLICY "Admins can manage all budget tours"
ON public.budget_tours
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Add admin read policy for media_library
CREATE POLICY "Admins can manage all media"
ON public.media_library
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: Add assigned users SELECT on budget_optional_selections
CREATE POLICY "Assigned users can view optional selections"
ON public.budget_optional_selections
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM budgets b
  WHERE b.id = budget_optional_selections.budget_id
  AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
));
