-- Helpers
CREATE OR REPLACE FUNCTION public.parse_metragem_m2(_raw text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(
    regexp_replace(
      COALESCE((regexp_match(COALESCE(_raw, ''), '([0-9]+[.,]?[0-9]*)'))[1], ''),
      ',', '.'
    ), ''
  )::numeric
$$;

CREATE OR REPLACE FUNCTION public.metragem_bucket(_m2 numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _m2 IS NULL THEN 'não informado'
    WHEN _m2 <= 50   THEN '≤ 50 m²'
    WHEN _m2 <= 100  THEN '51–100 m²'
    WHEN _m2 <= 200  THEN '101–200 m²'
    WHEN _m2 <= 400  THEN '201–400 m²'
    ELSE '400+ m²'
  END
$$;

CREATE OR REPLACE FUNCTION public.is_won_status(_s text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s = 'contrato_fechado'
$$;

CREATE OR REPLACE FUNCTION public.is_lost_status(_s text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s IN ('lost','perdido')
$$;

-- Base unificada
CREATE OR REPLACE VIEW public.v_sales_budgets_enriched AS
WITH totals AS (
  SELECT id, total FROM public.get_budget_totals()
),
lead_in AS (
  SELECT be.budget_id, MIN(be.created_at) AS lead_at
  FROM public.budget_events be
  WHERE be.event_type = 'status_change'
  GROUP BY be.budget_id
),
terminal_in AS (
  SELECT
    be.budget_id,
    MAX(CASE WHEN be.to_status = 'contrato_fechado'  THEN be.created_at END) AS won_at,
    MAX(CASE WHEN be.to_status IN ('lost','perdido') THEN be.created_at END) AS lost_at,
    MAX(CASE WHEN be.to_status IN ('sent_to_client','published','minuta_solicitada','contrato_fechado')
             THEN be.created_at END) AS first_sent_at
  FROM public.budget_events be
  WHERE be.event_type = 'status_change'
  GROUP BY be.budget_id
)
SELECT
  b.id,
  b.created_at,
  b.updated_at,
  b.internal_status,
  b.pipeline_stage,
  b.commercial_owner_id,
  b.lead_source,
  COALESCE(cp.location_type, b.location_type) AS location_type,
  COALESCE(cp.property_type, b.property_type) AS property_type,
  COALESCE(cp.metragem, b.metragem) AS metragem_raw,
  public.parse_metragem_m2(COALESCE(cp.metragem, b.metragem)) AS metragem_m2,
  public.metragem_bucket(public.parse_metragem_m2(COALESCE(cp.metragem, b.metragem))) AS metragem_bucket,
  COALESCE(t.total, 0)::numeric AS total_value,
  COALESCE(li.lead_at, b.created_at) AS lead_at,
  ti.first_sent_at,
  ti.won_at,
  ti.lost_at,
  public.is_won_status(b.internal_status)  AS is_won,
  public.is_lost_status(b.internal_status) AS is_lost,
  CASE
    WHEN public.is_won_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.won_at,  b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    WHEN public.is_lost_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.lost_at, b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    ELSE NULL
  END AS cycle_days,
  CASE
    WHEN public.is_won_status(b.internal_status) OR public.is_lost_status(b.internal_status) THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - COALESCE(li.lead_at, b.created_at))) / 86400.0
  END AS open_days
FROM public.budgets b
LEFT JOIN public.client_properties cp ON cp.id = b.property_id
LEFT JOIN totals      t  ON t.id = b.id
LEFT JOIN lead_in     li ON li.budget_id = b.id
LEFT JOIN terminal_in ti ON ti.budget_id = b.id;

-- Overview macro
CREATE OR REPLACE VIEW public.v_sales_kpis_overview AS
SELECT
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL) AS proposals_sent,
  COUNT(*) FILTER (WHERE is_won)  AS deals_won,
  COUNT(*) FILTER (WHERE is_lost) AS deals_lost,
  COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost) AS deals_open,
  CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
                / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
       ELSE 0 END AS win_rate_pct,
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric / COUNT(*), 2)
       ELSE 0 END AS lead_to_won_pct,
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
       ELSE 0 END AS proposal_rate_pct,
  ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2) AS avg_deal_size_won,
  COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric  AS revenue_won,
  COALESCE(SUM(total_value) FILTER (WHERE is_lost), 0)::numeric AS revenue_lost,
  COALESCE(SUM(total_value) FILTER (WHERE NOT is_won AND NOT is_lost), 0)::numeric AS pipeline_open_value,
  ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days) AS p50_cycle_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cycle_days) AS p90_cycle_days
FROM public.v_sales_budgets_enriched;

-- Por vendedora (profiles só tem full_name)
CREATE OR REPLACE VIEW public.v_sales_cycle_by_owner AS
SELECT
  e.commercial_owner_id AS owner_id,
  COALESCE(p.full_name, 'Sem responsável') AS owner_name,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL) AS proposals_sent,
  COUNT(*) FILTER (WHERE e.is_won)  AS deals_won,
  COUNT(*) FILTER (WHERE e.is_lost) AS deals_lost,
  COUNT(*) FILTER (WHERE NOT e.is_won AND NOT e.is_lost) AS deals_open,
  CASE WHEN COUNT(*) FILTER (WHERE e.is_won OR e.is_lost) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.is_won)::numeric
                / COUNT(*) FILTER (WHERE e.is_won OR e.is_lost), 2)
       ELSE 0 END AS win_rate_pct,
  ROUND(AVG(e.cycle_days) FILTER (WHERE e.cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.cycle_days) AS p50_cycle_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY e.cycle_days) AS p90_cycle_days,
  ROUND(AVG(e.total_value) FILTER (WHERE e.is_won)::numeric, 2) AS avg_deal_size_won,
  COALESCE(SUM(e.total_value) FILTER (WHERE e.is_won), 0)::numeric AS revenue_won,
  COALESCE(SUM(e.total_value) FILTER (WHERE NOT e.is_won AND NOT e.is_lost), 0)::numeric AS pipeline_open_value
FROM public.v_sales_budgets_enriched e
LEFT JOIN public.profiles p ON p.id = e.commercial_owner_id
GROUP BY e.commercial_owner_id, p.full_name;

-- Tempo em etapa
CREATE OR REPLACE VIEW public.v_sales_time_in_stage AS
WITH ordered AS (
  SELECT
    be.budget_id,
    be.to_status AS stage,
    be.created_at AS entered_at,
    LEAD(be.created_at) OVER (PARTITION BY be.budget_id ORDER BY be.created_at) AS exited_at,
    b.commercial_owner_id
  FROM public.budget_events be
  JOIN public.budgets b ON b.id = be.budget_id
  WHERE be.event_type = 'status_change' AND be.to_status IS NOT NULL
),
stage_durations AS (
  SELECT budget_id, commercial_owner_id, stage,
    EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 86400.0 AS days_in_stage,
    entered_at
  FROM ordered
)
SELECT
  stage,
  COUNT(*) AS sample_size,
  ROUND(AVG(days_in_stage)::numeric, 1) AS avg_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_in_stage) AS p50_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY days_in_stage) AS p90_days,
  MIN(days_in_stage) AS min_days,
  MAX(days_in_stage) AS max_days
FROM stage_durations
GROUP BY stage
ORDER BY avg_days DESC NULLS LAST;

-- Conversão por segmento
CREATE OR REPLACE FUNCTION public.sales_conversion_by_segment(_dimension text)
RETURNS TABLE (
  segment text, total_leads bigint, proposals_sent bigint,
  deals_won bigint, deals_lost bigint, deals_open bigint,
  win_rate_pct numeric, proposal_rate_pct numeric,
  avg_cycle_days numeric, avg_deal_size_won numeric, revenue_won numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF _dimension NOT IN ('metragem','location_type','property_type','lead_source') THEN
    RAISE EXCEPTION 'Dimensão inválida: %.', _dimension;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT
      COALESCE(%I, 'não informado')::text AS segment,
      COUNT(*)::bigint,
      COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::bigint,
      COUNT(*) FILTER (WHERE is_won)::bigint,
      COUNT(*) FILTER (WHERE is_lost)::bigint,
      COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost)::bigint,
      CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
                    / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
           ELSE 0 END,
      CASE WHEN COUNT(*) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
           ELSE 0 END,
      ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1),
      ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2),
      COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric
    FROM public.v_sales_budgets_enriched
    GROUP BY 1
    ORDER BY 2 DESC
  $q$,
    CASE _dimension WHEN 'metragem' THEN 'metragem_bucket' ELSE _dimension END
  );
END;
$$;

-- Coortes mensais
CREATE OR REPLACE VIEW public.v_sales_cohort_monthly AS
SELECT
  date_trunc('month', lead_at)::date AS cohort_month,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL) AS proposals_sent,
  COUNT(*) FILTER (WHERE is_won)  AS deals_won,
  COUNT(*) FILTER (WHERE is_lost) AS deals_lost,
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric / COUNT(*), 2)
       ELSE 0 END AS lead_to_won_pct,
  ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
  COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric AS revenue_won
FROM public.v_sales_budgets_enriched
GROUP BY 1
ORDER BY 1 DESC;

-- Motivos de perda
CREATE OR REPLACE VIEW public.v_sales_lost_reasons_ranked AS
SELECT
  blr.reason_category AS reason,
  COUNT(*) AS qty,
  ROUND(100.0 * COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct_of_lost,
  COALESCE(SUM(eb.total_value), 0)::numeric AS revenue_lost,
  ROUND(AVG(eb.total_value)::numeric, 2) AS avg_deal_size,
  COALESCE(SUM(blr.competitor_value), 0)::numeric AS competitor_value_total
FROM public.budget_lost_reasons blr
LEFT JOIN public.v_sales_budgets_enriched eb ON eb.id = blr.budget_id
GROUP BY blr.reason_category
ORDER BY qty DESC;

-- RPC consolidada
CREATE OR REPLACE FUNCTION public.sales_kpis_dashboard(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL,
  _owner_id   uuid        DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE _result jsonb;
BEGIN
  WITH scoped AS (
    SELECT * FROM public.v_sales_budgets_enriched
    WHERE (_start_date IS NULL OR lead_at >= _start_date)
      AND (_end_date   IS NULL OR lead_at <= _end_date)
      AND (_owner_id   IS NULL OR commercial_owner_id = _owner_id)
  ),
  overview AS (
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL) AS proposals_sent,
      COUNT(*) FILTER (WHERE is_won)  AS deals_won,
      COUNT(*) FILTER (WHERE is_lost) AS deals_lost,
      COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost) AS deals_open,
      CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
                    / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
           ELSE 0 END AS win_rate_pct,
      CASE WHEN COUNT(*) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
           ELSE 0 END AS proposal_rate_pct,
      ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days) AS p50_cycle_days,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cycle_days) AS p90_cycle_days,
      ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2) AS avg_deal_size_won,
      COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric  AS revenue_won,
      COALESCE(SUM(total_value) FILTER (WHERE is_lost), 0)::numeric AS revenue_lost,
      COALESCE(SUM(total_value) FILTER (WHERE NOT is_won AND NOT is_lost), 0)::numeric AS pipeline_open_value
    FROM scoped
  )
  SELECT to_jsonb(overview.*) INTO _result FROM overview;
  RETURN _result;
END;
$$;

-- Permissões
GRANT SELECT ON public.v_sales_budgets_enriched    TO authenticated;
GRANT SELECT ON public.v_sales_kpis_overview       TO authenticated;
GRANT SELECT ON public.v_sales_cycle_by_owner      TO authenticated;
GRANT SELECT ON public.v_sales_time_in_stage       TO authenticated;
GRANT SELECT ON public.v_sales_cohort_monthly      TO authenticated;
GRANT SELECT ON public.v_sales_lost_reasons_ranked TO authenticated;

GRANT EXECUTE ON FUNCTION public.parse_metragem_m2(text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.metragem_bucket(numeric)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_won_status(text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lost_status(text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_conversion_by_segment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_dashboard(timestamptz, timestamptz, uuid) TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS budget_events_budget_created_idx
  ON public.budget_events (budget_id, created_at);
CREATE INDEX IF NOT EXISTS budgets_internal_status_idx
  ON public.budgets (internal_status);
CREATE INDEX IF NOT EXISTS budgets_owner_idx
  ON public.budgets (commercial_owner_id);
