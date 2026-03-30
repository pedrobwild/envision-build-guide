
-- Extend budgets with request/briefing fields
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS property_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS demand_context text,
  ADD COLUMN IF NOT EXISTS briefing text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS reference_links jsonb DEFAULT '[]'::jsonb;
