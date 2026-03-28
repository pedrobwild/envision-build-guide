
ALTER TABLE public.budgets DROP CONSTRAINT budgets_status_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check CHECK (status = ANY (ARRAY['draft', 'published', 'approved', 'expired', 'archived', 'contrato_fechado', 'minuta_solicitada']));
