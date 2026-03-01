
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name text DEFAULT NULL;
