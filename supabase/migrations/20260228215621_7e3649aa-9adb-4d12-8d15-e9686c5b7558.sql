
-- Allow anonymous PATCH of view_count and last_viewed_at on published budgets
CREATE POLICY "Public can update view count on published budgets"
  ON public.budgets
  FOR UPDATE
  USING (status = 'published' AND public_id IS NOT NULL)
  WITH CHECK (status = 'published' AND public_id IS NOT NULL);
