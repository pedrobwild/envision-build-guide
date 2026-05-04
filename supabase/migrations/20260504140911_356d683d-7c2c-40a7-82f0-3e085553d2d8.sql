CREATE TABLE public.open_budget_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  correlation_id UUID NOT NULL,
  source TEXT NOT NULL,
  outcome TEXT NOT NULL,
  popup_blocked BOOLEAN NOT NULL DEFAULT false,
  input_public_id TEXT,
  resolved_public_id TEXT,
  resolved_from TEXT,
  input_status TEXT,
  input_budget_id UUID,
  error_message TEXT,
  duration_ms INTEGER,
  route TEXT,
  user_agent TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  deploy_version TEXT,
  reporter_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX open_budget_telemetry_event_id_idx
  ON public.open_budget_telemetry (event_id);
CREATE INDEX open_budget_telemetry_correlation_id_idx
  ON public.open_budget_telemetry (correlation_id);
CREATE INDEX open_budget_telemetry_outcome_idx
  ON public.open_budget_telemetry (outcome);
CREATE INDEX open_budget_telemetry_created_at_idx
  ON public.open_budget_telemetry (created_at DESC);

ALTER TABLE public.open_budget_telemetry ENABLE ROW LEVEL SECURITY;

-- Insert público (anônimos e logados): necessário para captura completa.
CREATE POLICY "open_budget_telemetry_public_insert"
  ON public.open_budget_telemetry
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Select restrito a admins.
CREATE POLICY "open_budget_telemetry_admin_select"
  ON public.open_budget_telemetry
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));