
DROP POLICY IF EXISTS "Public can update view count on published budgets" ON public.budgets;

CREATE POLICY "Public can update published budgets"
ON public.budgets
FOR UPDATE
TO public
USING ((status = 'published' OR status = 'minuta_solicitada') AND public_id IS NOT NULL)
WITH CHECK ((status IN ('published', 'minuta_solicitada')) AND public_id IS NOT NULL);
