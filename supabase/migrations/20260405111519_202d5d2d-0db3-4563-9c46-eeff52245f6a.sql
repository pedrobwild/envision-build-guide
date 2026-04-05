CREATE POLICY "Anon can view published budgets"
ON public.budgets
FOR SELECT
TO anon
USING (status IN ('published', 'minuta_solicitada') AND public_id IS NOT NULL);