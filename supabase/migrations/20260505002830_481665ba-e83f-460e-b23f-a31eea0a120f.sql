-- 1) Remove broad SELECT policies on budgets that exposed internal/PII columns to anon and any authenticated user.
-- Public-facing access continues via SECURITY DEFINER RPCs (get_public_budget, get_public_budget_full, get_public_budget_total)
-- which only return whitelisted columns. Internal users keep their role-scoped policies (admin/orcamentista/comercial/owner).
DROP POLICY IF EXISTS "Anon can view published budgets" ON public.budgets;
DROP POLICY IF EXISTS "Authenticated can view published budgets" ON public.budgets;

-- 2) Remove budget_events from the realtime publication.
-- No client subscribes to it; keeping it in the publication would let any authenticated user
-- listen to change broadcasts for budgets they don't own.
ALTER PUBLICATION supabase_realtime DROP TABLE public.budget_events;