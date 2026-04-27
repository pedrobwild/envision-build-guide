ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_installments integer;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_payment_method_check;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cartao', 'fluxo_obra'));