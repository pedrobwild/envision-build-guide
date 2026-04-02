ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS location_type text;