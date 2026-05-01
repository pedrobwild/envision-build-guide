ALTER TABLE public.commercial_targets
  ADD COLUMN IF NOT EXISTS revenue_override_brl numeric;

COMMENT ON COLUMN public.commercial_targets.revenue_override_brl IS
  'Override manual do resultado de receita exibido no painel comercial (quando NULL, usa o calculado a partir dos negócios fechados).';