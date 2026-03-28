
DROP POLICY IF EXISTS "Public can view published budgets by public_id" ON public.budgets;

CREATE POLICY "Public can view published budgets by public_id"
ON public.budgets
FOR SELECT
TO anon
USING (status IN ('published', 'minuta_solicitada') AND public_id IS NOT NULL);
