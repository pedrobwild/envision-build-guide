DROP POLICY IF EXISTS "Authenticated users can insert insights" ON public.operations_insights_history;

CREATE POLICY "Users can insert their own insights"
  ON public.operations_insights_history
  FOR INSERT
  TO authenticated
  WITH CHECK (generated_by = auth.uid());