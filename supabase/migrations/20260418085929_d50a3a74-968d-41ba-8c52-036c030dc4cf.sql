-- 1. Tabela de alertas proativos
CREATE TABLE IF NOT EXISTS public.operations_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_name TEXT,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  snapshot_date DATE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operations_alerts_unresolved
  ON public.operations_alerts (created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_operations_alerts_type_date
  ON public.operations_alerts (alert_type, snapshot_date);

ALTER TABLE public.operations_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all alerts"
  ON public.operations_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read alerts"
  ON public.operations_alerts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manage alerts"
  ON public.operations_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Time-in-stage: tempo médio em cada etapa via budget_events
CREATE OR REPLACE FUNCTION public.calc_time_in_stage(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS TABLE(
  stage TEXT,
  avg_days NUMERIC,
  median_days NUMERIC,
  p90_days NUMERIC,
  sample_size INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH transitions AS (
    SELECT
      e.budget_id,
      e.to_status   AS stage_in,
      e.created_at  AS entered_at,
      LEAD(e.created_at) OVER (PARTITION BY e.budget_id ORDER BY e.created_at) AS exited_at
    FROM public.budget_events e
    JOIN public.budgets b ON b.id = e.budget_id
    WHERE e.event_type = 'status_change'
      AND e.to_status IS NOT NULL
      AND b.created_at >= '2026-04-15'::timestamptz
      AND e.created_at BETWEEN p_from AND p_to
  ),
  durations AS (
    SELECT
      stage_in AS stage,
      EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 86400.0 AS days
    FROM transitions
    WHERE COALESCE(exited_at, now()) > entered_at
  )
  SELECT
    stage,
    ROUND(AVG(days)::numeric, 2) AS avg_days,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 2) AS median_days,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY days)::numeric, 2) AS p90_days,
    COUNT(*)::INTEGER AS sample_size
  FROM durations
  GROUP BY stage
  ORDER BY avg_days DESC NULLS LAST;
$$;

-- 3. RPC consolidada de dashboard (1 round-trip)
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
  v_active_statuses TEXT[] := ARRAY['novo','em_analise','aguardando_info','em_revisao','delivered_to_sales','published','minuta_solicitada'];
  v_closed_statuses TEXT[] := ARRAY['contrato_fechado','perdido'];
  v_ops_start TIMESTAMPTZ := '2026-04-15'::timestamptz;
BEGIN
  WITH base AS (
    SELECT b.id, b.internal_status, b.created_at, b.due_at, b.closed_at,
           b.manual_total, b.internal_cost,
           COALESCE(b.manual_total, (SELECT COALESCE(SUM(s.section_price),0) FROM sections s WHERE s.budget_id = b.id)) AS total
    FROM budgets b
    WHERE b.created_at >= v_ops_start
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) AS received_today,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_active_statuses)) AS backlog,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_closed_statuses)) AS closed,
      COUNT(*) FILTER (WHERE internal_status = 'contrato_fechado') AS won,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_active_statuses) AND due_at IS NOT NULL AND due_at < now()) AS overdue,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_active_statuses) AND due_at IS NOT NULL) AS with_due,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_active_statuses) AND due_at IS NOT NULL AND due_at >= now()) AS on_time,
      COUNT(*) FILTER (WHERE internal_status = ANY(v_active_statuses) AND due_at IS NOT NULL
                         AND EXTRACT(EPOCH FROM (due_at - now())) BETWEEN 0 AND 172800) AS at_risk_48h,
      COALESCE(SUM(total) FILTER (WHERE internal_status = ANY(v_active_statuses)), 0) AS portfolio_value,
      COALESCE(SUM(total) FILTER (WHERE internal_status = 'contrato_fechado'), 0) AS revenue,
      COALESCE(SUM(internal_cost) FILTER (WHERE internal_status = 'contrato_fechado'), 0) AS total_cost
    FROM base
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'volumes', jsonb_build_object(
      'received_today', received_today,
      'backlog', backlog,
      'closed', closed,
      'won', won,
      'overdue', overdue
    ),
    'sla', jsonb_build_object(
      'on_time_pct', CASE WHEN with_due > 0 THEN ROUND((on_time::numeric / with_due) * 10000) / 100 ELSE NULL END,
      'at_risk_48h', at_risk_48h,
      'with_due', with_due
    ),
    'commercial', jsonb_build_object(
      'conversion_pct', CASE WHEN closed > 0 THEN ROUND((won::numeric / closed) * 10000) / 100 ELSE NULL END,
      'portfolio_value_brl', portfolio_value,
      'revenue_brl', revenue,
      'avg_ticket_brl', CASE WHEN won > 0 THEN ROUND((revenue / won)::numeric, 2) ELSE NULL END,
      'gross_margin_pct', CASE WHEN revenue > 0 THEN ROUND(((revenue - total_cost) / revenue * 10000)::numeric) / 100 ELSE NULL END
    )
  ) INTO result FROM agg;

  RETURN result;
END;
$$;

-- 4. Comparação entre dois snapshots
CREATE OR REPLACE FUNCTION public.compare_snapshots(
  p_date_a DATE,
  p_date_b DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  snap_a RECORD;
  snap_b RECORD;
  metrics JSONB := '[]'::jsonb;
  metric_keys TEXT[] := ARRAY[
    'received_count','backlog_count','overdue_count','closed_count',
    'sla_on_time_pct','avg_lead_time_days','conversion_rate_pct',
    'revenue_brl','portfolio_value_brl','gross_margin_pct',
    'health_score','weekly_throughput'
  ];
  k TEXT;
  va NUMERIC;
  vb NUMERIC;
  delta NUMERIC;
  delta_pct NUMERIC;
BEGIN
  SELECT * INTO snap_a FROM daily_metrics_snapshot WHERE snapshot_date = p_date_a LIMIT 1;
  SELECT * INTO snap_b FROM daily_metrics_snapshot WHERE snapshot_date = p_date_b LIMIT 1;

  IF snap_a.id IS NULL OR snap_b.id IS NULL THEN
    RETURN jsonb_build_object('error', 'snapshot_not_found',
                              'has_a', snap_a.id IS NOT NULL,
                              'has_b', snap_b.id IS NOT NULL);
  END IF;

  FOREACH k IN ARRAY metric_keys LOOP
    EXECUTE format('SELECT ($1).%I::numeric, ($2).%I::numeric', k, k)
      INTO va, vb USING snap_a, snap_b;
    delta := COALESCE(vb, 0) - COALESCE(va, 0);
    delta_pct := CASE WHEN va IS NOT NULL AND va <> 0 THEN ROUND((delta / va * 10000)::numeric) / 100 ELSE NULL END;
    metrics := metrics || jsonb_build_object(
      'key', k,
      'value_a', va,
      'value_b', vb,
      'delta', delta,
      'delta_pct', delta_pct
    );
  END LOOP;

  RETURN jsonb_build_object(
    'date_a', p_date_a,
    'date_b', p_date_b,
    'health_diagnosis_a', snap_a.health_diagnosis,
    'health_diagnosis_b', snap_b.health_diagnosis,
    'metrics', metrics
  );
END;
$$;

-- 5. Verificador de alertas (chamado pelo cron diário após snapshot)
CREATE OR REPLACE FUNCTION public.check_and_create_alerts()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  latest RECORD;
  prev_week RECORD;
  created INTEGER := 0;
  backlog_growth_pct NUMERIC;
BEGIN
  SELECT * INTO latest FROM daily_metrics_snapshot ORDER BY snapshot_date DESC LIMIT 1;
  IF latest.id IS NULL THEN RETURN 0; END IF;

  SELECT * INTO prev_week FROM daily_metrics_snapshot
    WHERE snapshot_date = latest.snapshot_date - INTERVAL '7 days' LIMIT 1;

  -- Health score crítico
  IF latest.health_score IS NOT NULL AND latest.health_score < 60 THEN
    INSERT INTO operations_alerts (alert_type, severity, title, message,
      metric_name, metric_value, threshold_value, snapshot_date)
    SELECT 'health_score_low',
      CASE WHEN latest.health_score < 40 THEN 'critical' ELSE 'warning' END,
      'Health score baixo',
      'Health score caiu para ' || latest.health_score || '/100 (' || latest.health_diagnosis || ')',
      'health_score', latest.health_score, 60, latest.snapshot_date
    WHERE NOT EXISTS (
      SELECT 1 FROM operations_alerts
      WHERE alert_type='health_score_low' AND snapshot_date=latest.snapshot_date AND resolved=false
    );
    GET DIAGNOSTICS created = ROW_COUNT;
  END IF;

  -- SLA baixo
  IF latest.sla_on_time_pct IS NOT NULL AND latest.sla_on_time_pct < 70 THEN
    INSERT INTO operations_alerts (alert_type, severity, title, message,
      metric_name, metric_value, threshold_value, snapshot_date)
    SELECT 'sla_low',
      CASE WHEN latest.sla_on_time_pct < 50 THEN 'critical' ELSE 'warning' END,
      'SLA abaixo do alvo',
      'SLA caiu para ' || latest.sla_on_time_pct || '% (alvo: 70%)',
      'sla_on_time_pct', latest.sla_on_time_pct, 70, latest.snapshot_date
    WHERE NOT EXISTS (
      SELECT 1 FROM operations_alerts
      WHERE alert_type='sla_low' AND snapshot_date=latest.snapshot_date AND resolved=false
    );
    created := created + COALESCE((SELECT 1 WHERE FOUND), 0);
  END IF;

  -- Backlog crescendo > 30% em 7 dias
  IF prev_week.id IS NOT NULL AND prev_week.backlog_count > 0 THEN
    backlog_growth_pct := ((latest.backlog_count - prev_week.backlog_count)::numeric / prev_week.backlog_count) * 100;
    IF backlog_growth_pct > 30 THEN
      INSERT INTO operations_alerts (alert_type, severity, title, message,
        metric_name, metric_value, threshold_value, snapshot_date, metadata)
      SELECT 'backlog_growth',
        CASE WHEN backlog_growth_pct > 60 THEN 'critical' ELSE 'warning' END,
        'Backlog crescendo rápido',
        'Backlog cresceu ' || ROUND(backlog_growth_pct, 1) || '% em 7 dias (' || prev_week.backlog_count || ' → ' || latest.backlog_count || ')',
        'backlog_count', latest.backlog_count, prev_week.backlog_count, latest.snapshot_date,
        jsonb_build_object('growth_pct', backlog_growth_pct, 'prev_week', prev_week.backlog_count)
      WHERE NOT EXISTS (
        SELECT 1 FROM operations_alerts
        WHERE alert_type='backlog_growth' AND snapshot_date=latest.snapshot_date AND resolved=false
      );
      created := created + COALESCE((SELECT 1 WHERE FOUND), 0);
    END IF;
  END IF;

  -- Atrasos altos
  IF latest.overdue_count > 5 THEN
    INSERT INTO operations_alerts (alert_type, severity, title, message,
      metric_name, metric_value, threshold_value, snapshot_date)
    SELECT 'overdue_high',
      CASE WHEN latest.overdue_count > 15 THEN 'critical' ELSE 'warning' END,
      'Muitos orçamentos atrasados',
      latest.overdue_count || ' orçamentos passaram do prazo',
      'overdue_count', latest.overdue_count, 5, latest.snapshot_date
    WHERE NOT EXISTS (
      SELECT 1 FROM operations_alerts
      WHERE alert_type='overdue_high' AND snapshot_date=latest.snapshot_date AND resolved=false
    );
    created := created + COALESCE((SELECT 1 WHERE FOUND), 0);
  END IF;

  RETURN created;
END;
$$;