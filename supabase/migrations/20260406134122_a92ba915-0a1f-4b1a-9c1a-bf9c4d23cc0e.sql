CREATE POLICY "Orcamentista can view unassigned budgets"
ON public.budgets FOR SELECT
TO authenticated
USING (estimator_owner_id IS NULL AND has_role(auth.uid(), 'orcamentista'::app_role));