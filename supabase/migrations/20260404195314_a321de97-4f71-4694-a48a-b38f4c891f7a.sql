
ALTER TABLE public.budget_template_items
  ADD COLUMN IF NOT EXISTS internal_unit_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS internal_total numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bdi_percentage numeric DEFAULT 0;
