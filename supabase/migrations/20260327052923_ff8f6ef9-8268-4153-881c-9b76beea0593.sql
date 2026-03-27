
-- Add is_optional column to sections
ALTER TABLE public.sections ADD COLUMN is_optional boolean NOT NULL DEFAULT false;

-- Create table to store client optional selections
CREATE TABLE public.budget_optional_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  client_name text,
  client_email text,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.budget_optional_selections ENABLE ROW LEVEL SECURITY;

-- Public (anon) can insert selections on published budgets
CREATE POLICY "Anon can insert optional selections on published budgets"
ON public.budget_optional_selections
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets
    WHERE budgets.id = budget_optional_selections.budget_id
    AND budgets.status = 'published'
    AND budgets.public_id IS NOT NULL
  )
);

-- Public can view their own selections (by budget_id)
CREATE POLICY "Anon can view optional selections on published budgets"
ON public.budget_optional_selections
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.budgets
    WHERE budgets.id = budget_optional_selections.budget_id
    AND budgets.status = 'published'
    AND budgets.public_id IS NOT NULL
  )
);

-- Authenticated users can manage selections for their budgets
CREATE POLICY "Users manage optional selections via budget ownership"
ON public.budget_optional_selections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets
    WHERE budgets.id = budget_optional_selections.budget_id
    AND budgets.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets
    WHERE budgets.id = budget_optional_selections.budget_id
    AND budgets.created_by = auth.uid()
  )
);
