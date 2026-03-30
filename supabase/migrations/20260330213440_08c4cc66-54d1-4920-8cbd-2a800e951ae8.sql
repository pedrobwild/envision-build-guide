
CREATE TABLE public.budget_tours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  room_label text NOT NULL,
  tour_url text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.budget_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view tours of published budgets"
  ON public.budget_tours FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = budget_tours.budget_id
      AND budgets.status IN ('published', 'minuta_solicitada')
      AND budgets.public_id IS NOT NULL
  ));

CREATE POLICY "Users manage tours via budget ownership"
  ON public.budget_tours FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = budget_tours.budget_id
      AND budgets.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = budget_tours.budget_id
      AND budgets.created_by = auth.uid()
  ));
