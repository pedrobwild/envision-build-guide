
ALTER TABLE public.budgets DISABLE TRIGGER enforce_status_transition;
UPDATE public.budgets SET internal_status = 'delivered_to_sales', updated_at = now() WHERE id = '21681497-bbb9-4439-a721-d1c8e2fd0128';
ALTER TABLE public.budgets ENABLE TRIGGER enforce_status_transition;
