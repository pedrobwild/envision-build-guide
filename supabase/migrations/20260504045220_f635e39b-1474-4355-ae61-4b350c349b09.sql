CREATE OR REPLACE FUNCTION public.sales_kpis_by_owner(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  owner_id            uuid,
  owner_email         text,
  owner_name          text,
  total_leads         bigint,
  proposals_sent      bigint,
  deals_won           bigint,
  deals_lost          bigint,
  deals_open          bigint,
  win_rate_pct        numeric,
  avg_cycle_days      numeric,
  p50_cycle_days      numeric,
  p90_cycle_days      numeric,
  avg_deal_size_won   numeric,
  revenue_won         numeric,
  pipeline_open_value numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.commercial_owner_id,
    COALESCE(u.email, 'sem_dono'),
    COALESCE(NULLIF(p.full_name, ''), u.email, 'Sem responsável'),
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE e.is_won)::bigint,
    COUNT(*) FILTER (WHERE e.is_lost)::bigint,
    COUNT(*) FILTER (WHERE NOT e.is_won AND NOT e.is_lost)::bigint,
    CASE WHEN COUNT(*) FILTER (WHERE e.is_won OR e.is_lost) > 0
         THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.is_won)::numeric
                    / COUNT(*) FILTER (WHERE e.is_won OR e.is_lost), 2)
         ELSE 0 END,
    ROUND(AVG(e.cycle_days) FILTER (WHERE e.cycle_days IS NOT NULL)::numeric, 1),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.cycle_days),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY e.cycle_days),
    ROUND(AVG(e.total_value) FILTER (WHERE e.is_won)::numeric, 2),
    COALESCE(SUM(e.total_value) FILTER (WHERE e.is_won), 0)::numeric,
    COALESCE(SUM(e.total_value) FILTER (WHERE NOT e.is_won AND NOT e.is_lost), 0)::numeric
  FROM public.v_sales_budgets_enriched e
  LEFT JOIN public.profiles p ON p.id = e.commercial_owner_id
  LEFT JOIN auth.users u ON u.id = e.commercial_owner_id
  WHERE (_start_date IS NULL OR e.lead_at >= _start_date)
    AND (_end_date   IS NULL OR e.lead_at <= _end_date)
  GROUP BY e.commercial_owner_id, u.email, p.full_name
  ORDER BY 14 DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.sales_kpis_by_owner(timestamptz, timestamptz) IS
  'KPIs por vendedora filtrados por período (lead_at). SECURITY DEFINER para acessar auth.users.email.';

CREATE OR REPLACE FUNCTION public.sales_kpis_time_in_stage(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL,
  _owner_id   uuid        DEFAULT NULL
)
RETURNS TABLE (
  stage         text,
  sample_size   bigint,
  avg_days      numeric,
  p50_days      numeric,
  p90_days      numeric,
  min_days      numeric,
  max_days      numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH ordered AS (
    SELECT
      be.budget_id,
      be.to_status AS stage,
      be.created_at AS entered_at,
      LEAD(be.created_at) OVER (PARTITION BY be.budget_id ORDER BY be.created_at) AS exited_at,
      b.commercial_owner_id
    FROM public.budget_events be
    JOIN public.budgets b ON b.id = be.budget_id
    WHERE be.event_type = 'status_change'
      AND be.to_status IS NOT NULL
      AND (_owner_id   IS NULL OR b.commercial_owner_id = _owner_id)
      AND (_start_date IS NULL OR be.created_at >= _start_date)
      AND (_end_date   IS NULL OR be.created_at <= _end_date)
  ),
  stage_durations AS (
    SELECT stage,
      EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 86400.0 AS days_in_stage
    FROM ordered
  )
  SELECT
    stage,
    COUNT(*)::bigint,
    ROUND(AVG(days_in_stage)::numeric, 1),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_in_stage),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY days_in_stage),
    MIN(days_in_stage)::numeric,
    MAX(days_in_stage)::numeric
  FROM stage_durations
  GROUP BY stage
  ORDER BY 3 DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.sales_kpis_time_in_stage(timestamptz, timestamptz, uuid) IS
  'Tempo (avg/p50/p90) em cada etapa, filtrado por período e vendedora.';

CREATE OR REPLACE FUNCTION public.sales_kpis_cohorts(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL,
  _owner_id   uuid        DEFAULT NULL
)
RETURNS TABLE (
  cohort_month     date,
  leads            bigint,
  proposals_sent   bigint,
  deals_won        bigint,
  deals_lost       bigint,
  lead_to_won_pct  numeric,
  avg_cycle_days   numeric,
  revenue_won      numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    date_trunc('month', e.lead_at)::date,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL)::bigint,
    COUNT(*) FILTER (WHERE e.is_won)::bigint,
    COUNT(*) FILTER (WHERE e.is_lost)::bigint,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.is_won)::numeric / COUNT(*), 2)
         ELSE 0 END,
    ROUND(AVG(e.cycle_days) FILTER (WHERE e.cycle_days IS NOT NULL)::numeric, 1),
    COALESCE(SUM(e.total_value) FILTER (WHERE e.is_won), 0)::numeric
  FROM public.v_sales_budgets_enriched e
  WHERE (_start_date IS NULL OR e.lead_at >= _start_date)
    AND (_end_date   IS NULL OR e.lead_at <= _end_date)
    AND (_owner_id   IS NULL OR e.commercial_owner_id = _owner_id)
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

COMMENT ON FUNCTION public.sales_kpis_cohorts(timestamptz, timestamptz, uuid) IS
  'Coortes mensais filtradas por período (lead_at) e vendedora.';

CREATE OR REPLACE FUNCTION public.sales_kpis_lost_reasons(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL,
  _owner_id   uuid        DEFAULT NULL
)
RETURNS TABLE (
  reason                 text,
  qty                    bigint,
  pct_of_lost            numeric,
  revenue_lost           numeric,
  avg_deal_size          numeric,
  competitor_value_total numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    blr.reason_category,
    COUNT(*)::bigint,
    ROUND(100.0 * COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0), 2),
    COALESCE(SUM(eb.total_value), 0)::numeric,
    ROUND(AVG(eb.total_value)::numeric, 2),
    COALESCE(SUM(blr.competitor_value), 0)::numeric
  FROM public.budget_lost_reasons blr
  LEFT JOIN public.v_sales_budgets_enriched eb ON eb.id = blr.budget_id
  WHERE (_start_date IS NULL OR eb.lead_at >= _start_date)
    AND (_end_date   IS NULL OR eb.lead_at <= _end_date)
    AND (_owner_id   IS NULL OR eb.commercial_owner_id = _owner_id)
  GROUP BY blr.reason_category
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.sales_kpis_lost_reasons(timestamptz, timestamptz, uuid) IS
  'Ranking de motivos de perda, filtrado por período e vendedora.';

CREATE OR REPLACE FUNCTION public.sales_conversion_by_segment(
  _dimension  text,
  _start_date timestamptz,
  _end_date   timestamptz,
  _owner_id   uuid
)
RETURNS TABLE (
  segment           text,
  total_leads       bigint,
  proposals_sent    bigint,
  deals_won         bigint,
  deals_lost        bigint,
  deals_open        bigint,
  win_rate_pct      numeric,
  proposal_rate_pct numeric,
  avg_cycle_days    numeric,
  avg_deal_size_won numeric,
  revenue_won       numeric
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF _dimension NOT IN ('metragem','location_type','property_type','lead_source') THEN
    RAISE EXCEPTION 'Dimensão inválida: %. Use metragem | location_type | property_type | lead_source.', _dimension;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT
      COALESCE(%I, 'não informado')::text,
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
    WHERE ($1 IS NULL OR lead_at >= $1)
      AND ($2 IS NULL OR lead_at <= $2)
      AND ($3 IS NULL OR commercial_owner_id = $3)
    GROUP BY 1
    ORDER BY 2 DESC
  $q$,
    CASE _dimension WHEN 'metragem' THEN 'metragem_bucket' ELSE _dimension END
  )
  USING _start_date, _end_date, _owner_id;
END;
$$;

COMMENT ON FUNCTION public.sales_conversion_by_segment(text, timestamptz, timestamptz, uuid) IS
  'Conversão e ciclo por segmento, filtrados por período e vendedora.';

GRANT EXECUTE ON FUNCTION public.sales_kpis_by_owner(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_time_in_stage(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_cohorts(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_lost_reasons(timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_conversion_by_segment(text, timestamptz, timestamptz, uuid) TO authenticated;