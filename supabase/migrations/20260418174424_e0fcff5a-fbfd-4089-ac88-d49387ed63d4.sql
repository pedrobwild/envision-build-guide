-- 1. Add IA analysis columns to budget_meetings
ALTER TABLE public.budget_meetings
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS full_report jsonb;

-- 2. Indexes for matching meetings to budgets
CREATE INDEX IF NOT EXISTS idx_budgets_client_phone ON public.budgets (client_phone) WHERE client_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_lead_email ON public.budgets (lead_email) WHERE lead_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_meetings_external_id ON public.budget_meetings (provider, external_id) WHERE external_id IS NOT NULL;

-- 3. Sync state table
CREATE TABLE IF NOT EXISTS public.elephan_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_synced_at timestamptz,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  meetings_pulled integer NOT NULL DEFAULT 0,
  meetings_matched integer NOT NULL DEFAULT 0,
  meetings_unmatched integer NOT NULL DEFAULT 0,
  error_message text,
  raw_sample jsonb
);

ALTER TABLE public.elephan_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync state" ON public.elephan_sync_state
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages sync state" ON public.elephan_sync_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);