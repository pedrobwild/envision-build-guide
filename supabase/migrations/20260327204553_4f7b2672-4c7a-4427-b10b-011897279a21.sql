
ALTER TABLE public.budgets 
  ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS internal_cost numeric DEFAULT NULL;
