
-- Add versioning tracking columns to budgets
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS parent_budget_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS change_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_published_version boolean DEFAULT false;

-- Index for fast version group queries
CREATE INDEX IF NOT EXISTS idx_budgets_version_group ON public.budgets (version_group_id) WHERE version_group_id IS NOT NULL;

-- Index for fast parent lookups
CREATE INDEX IF NOT EXISTS idx_budgets_parent ON public.budgets (parent_budget_id) WHERE parent_budget_id IS NOT NULL;
