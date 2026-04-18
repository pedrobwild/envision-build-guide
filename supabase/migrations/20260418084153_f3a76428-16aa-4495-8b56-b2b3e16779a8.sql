-- ============================================================
-- DAILY METRICS SNAPSHOT — fotografia diária da operação
-- ============================================================
CREATE TABLE public.daily_metrics_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Volume
  received_count INTEGER NOT NULL DEFAULT 0,
  backlog_count INTEGER NOT NULL DEFAULT 0,
  overdue_count INTEGER NOT NULL DEFAULT 0,
  closed_count INTEGER NOT NULL DEFAULT 0,
  in_analysis_count INTEGER NOT NULL DEFAULT 0,
  delivered_to_sales_count INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,

  -- SLA
  sla_on_time_pct NUMERIC(5,2),
  sla_at_risk_count INTEGER NOT NULL DEFAULT 0,
  sla_breach_48h_count INTEGER NOT NULL DEFAULT 0,

  -- Tempo (em dias)
  avg_lead_time_days NUMERIC(6,2),
  median_lead_time_days NUMERIC(6,2),
  avg_time_in_analysis_days NUMERIC(6,2),
  avg_time_in_review_days NUMERIC(6,2),
  avg_time_to_publish_days NUMERIC(6,2),

  -- Comercial
  conversion_rate_pct NUMERIC(5,2),
  portfolio_value_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  revenue_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_ticket_brl NUMERIC(14,2),
  gross_margin_pct NUMERIC(5,2),

  -- Throughput
  weekly_throughput NUMERIC(6,2),
  throughput_trend_pct NUMERIC(6,2),

  -- Saúde
  health_score INTEGER,
  health_diagnosis TEXT,

  -- Equipe
  active_estimators INTEGER NOT NULL DEFAULT 0,
  active_commercial INTEGER NOT NULL DEFAULT 0,
  team_load_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Funis (snapshot estrutural)
  operational_funnel JSONB NOT NULL DEFAULT '[]'::jsonb,
  commercial_funnel JSONB NOT NULL DEFAULT '[]'::jsonb,
  aging_buckets JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_snapshot_date ON public.daily_metrics_snapshot (snapshot_date DESC);

-- RLS
ALTER TABLE public.daily_metrics_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON public.daily_metrics_snapshot FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage snapshots"
  ON public.daily_metrics_snapshot FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage snapshots"
  ON public.daily_metrics_snapshot FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- LEAD TIME via budget_events (preciso, do início ao envio)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calc_lead_time_from_events(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
  avg_days NUMERIC,
  median_days NUMERIC,
  sample_size INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH sent_events AS (
    SELECT DISTINCT ON (e.budget_id)
      e.budget_id,
      e.created_at AS sent_at,
      b.created_at AS budget_created_at
    FROM public.budget_events e
    JOIN public.budgets b ON b.id = e.budget_id
    WHERE e.event_type = 'status_change'
      AND e.to_status = 'sent_to_client'
      AND e.created_at BETWEEN p_from AND p_to
      AND b.created_at >= '2026-04-15'::timestamptz
    ORDER BY e.budget_id, e.created_at ASC
  ),
  durations AS (
    SELECT EXTRACT(EPOCH FROM (sent_at - budget_created_at)) / 86400.0 AS days
    FROM sent_events
    WHERE sent_at > budget_created_at
  )
  SELECT
    ROUND(AVG(days)::numeric, 2),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 2),
    COUNT(*)::INTEGER
  FROM durations;
$$;

-- ============================================================
-- CLEANUP de snapshots antigos (>365 dias)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM public.daily_metrics_snapshot
  WHERE snapshot_date < (CURRENT_DATE - INTERVAL '365 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ============================================================
-- ÍNDICES estratégicos para performance de KPIs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_budgets_status_created ON public.budgets (internal_status, created_at);
CREATE INDEX IF NOT EXISTS idx_budgets_estimator_status ON public.budgets (estimator_owner_id, internal_status) WHERE estimator_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_commercial_status ON public.budgets (commercial_owner_id, internal_status) WHERE commercial_owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_due_at ON public.budgets (due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_events_status_change ON public.budget_events (budget_id, event_type, created_at) WHERE event_type = 'status_change';