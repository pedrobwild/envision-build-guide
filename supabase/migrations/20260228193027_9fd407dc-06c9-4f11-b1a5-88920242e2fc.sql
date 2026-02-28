
-- Create rooms table for floor plan room definitions
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add coverage columns to items table
ALTER TABLE public.items
  ADD COLUMN coverage_type TEXT NOT NULL DEFAULT 'geral',
  ADD COLUMN included_rooms JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN excluded_rooms JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add floor_plan_url to budgets
ALTER TABLE public.budgets
  ADD COLUMN floor_plan_url TEXT;

-- RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view rooms of published budgets"
  ON public.rooms FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = rooms.budget_id
    AND budgets.status = 'published'
    AND budgets.public_id IS NOT NULL
  ));

CREATE POLICY "Users manage rooms via budget ownership"
  ON public.rooms FOR ALL
  USING (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = rooms.budget_id
    AND budgets.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM budgets
    WHERE budgets.id = rooms.budget_id
    AND budgets.created_by = auth.uid()
  ));
