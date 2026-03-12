
-- Add version tracking columns to budgets
ALTER TABLE public.budgets 
  ADD COLUMN IF NOT EXISTS version_group_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current_version boolean DEFAULT true;

-- Index for fast version group lookups
CREATE INDEX IF NOT EXISTS idx_budgets_version_group ON public.budgets (version_group_id) WHERE version_group_id IS NOT NULL;
