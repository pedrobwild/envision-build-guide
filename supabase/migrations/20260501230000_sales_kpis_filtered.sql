-- ============================================================
-- Sales KPIs — Filtros globais (período + vendedora)
--
-- O módulo de KPIs já tinha views/RPCs em
-- 20260501041500_sales_kpis_godmode.sql, mas só o overview
-- aceitava filtros. Os blocos secundários (vendedora,
-- tempo em etapa, segmentos, motivos de perda, coortes)
-- ignoravam o período e a vendedora selecionados na barra.
--
-- Esta migration adiciona versões parametrizadas como RPCs
-- (`SECURITY INVOKER`) para que o front-end possa aplicar os
-- mesmos filtros em toda a página.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Performance por vendedora (filtrada por período)
-- ------------------------------------------------------------
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    e.commercial_owner_id                                              AS owner_id,
    COALESCE(p.email, 'sem_dono')                                      AS owner_email,
    COALESCE(p.full_name, p.email, 'Sem responsável')                  AS owner_name,
    COUNT(*)::bigint                                                   AS total_leads,
    COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL)::bigint        AS proposals_sent,
    COUNT(*) FILTER (WHERE e.is_won)::bigint                           AS deals_won,
    COUNT(*) FILTER (WHERE e.is_lost)::bigint                          AS deals_lost,
    COUNT(*) FILTER (WHERE NOT e.is_won AND NOT e.is_lost)::bigint     AS deals_open,
    CASE WHEN COUNT(*) FILTER (WHERE e.is_won OR e.is_lost) > 0
         THEN ROUND(
           100.0 * COUNT(*) FILTER (WHERE e.is_won)::numeric
                / COUNT(*) FILTER (WHERE e.is_won OR e.is_lost), 2)
         ELSE 0 END                                                    AS win_rate_pct,
    ROUND(AVG(e.cycle_days) FILTER (WHERE e.cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.cycle_days)           AS p50_cycle_days,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY e.cycle_days)           AS p90_cycle_days,
    ROUND(AVG(e.total_value) FILTER (WHERE e.is_won)::numeric, 2)      AS avg_deal_size_won,
    COALESCE(SUM(e.total_value) FILTER (WHERE e.is_won), 0)::numeric   AS revenue_won,
    COALESCE(SUM(e.total_value) FILTER (WHERE NOT e.is_won AND NOT e.is_lost), 0)::numeric AS pipeline_open_value
  FROM public.v_sales_budgets_enriched e
  LEFT JOIN public.profiles p ON p.id = e.commercial_owner_id
  WHERE (_start_date IS NULL OR e.lead_at >= _start_date)
    AND (_end_date   IS NULL OR e.lead_at <= _end_date)
  GROUP BY e.commercial_owner_id, p.email, p.full_name
  ORDER BY revenue_won DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.sales_kpis_by_owner(timestamptz, timestamptz) IS
  'KPIs por vendedora filtrados por período (lead_at). O filtro de owner não é aplicado pois esta tabela já é o breakdown por owner.';

-- ------------------------------------------------------------
-- 2. Tempo médio em cada etapa (filtrado)
-- ------------------------------------------------------------
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      be.budget_id,
      be.to_status                                       AS stage,
      be.created_at                                      AS entered_at,
      LEAD(be.created_at) OVER (
        PARTITION BY be.budget_id ORDER BY be.created_at
      )                                                  AS exited_at,
      b.commercial_owner_id
    FROM public.budget_events be
    JOIN public.budgets b ON b.id = be.budget_id
    WHERE be.event_type = 'status_change'
      AND be.to_status IS NOT NULL
      AND (_owner_id IS NULL OR b.commercial_owner_id = _owner_id)
      AND (_start_date IS NULL OR be.created_at >= _start_date)
      AND (_end_date   IS NULL OR be.created_at <= _end_date)
  ),
  stage_durations AS (
    SELECT
      stage,
      EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 86400.0 AS days_in_stage
    FROM ordered
  )
  SELECT
    stage,
    COUNT(*)::bigint                                                AS sample_size,
    ROUND(AVG(days_in_stage)::numeric, 1)                           AS avg_days,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_in_stage)      AS p50_days,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY days_in_stage)      AS p90_days,
    MIN(days_in_stage)::numeric                                     AS min_days,
    MAX(days_in_stage)::numeric                                     AS max_days
  FROM stage_durations
  GROUP BY stage
  ORDER BY avg_days DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.sales_kpis_time_in_stage(timestamptz, timestamptz, uuid) IS
  'Tempo (avg/p50/p90) em cada etapa do pipeline, filtrado por período e vendedora.';

-- ------------------------------------------------------------
-- 3. Coortes mensais (filtradas)
-- ------------------------------------------------------------
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', e.lead_at)::date                                  AS cohort_month,
    COUNT(*)::bigint                                                       AS leads,
    COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL)::bigint            AS proposals_sent,
    COUNT(*) FILTER (WHERE e.is_won)::bigint                               AS deals_won,
    COUNT(*) FILTER (WHERE e.is_lost)::bigint                              AS deals_lost,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(100.0 * COUNT(*) FILTER (WHERE e.is_won)::numeric / COUNT(*), 2)
         ELSE 0 END                                                        AS lead_to_won_pct,
    ROUND(AVG(e.cycle_days) FILTER (WHERE e.cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
    COALESCE(SUM(e.total_value) FILTER (WHERE e.is_won), 0)::numeric       AS revenue_won
  FROM public.v_sales_budgets_enriched e
  WHERE (_start_date IS NULL OR e.lead_at >= _start_date)
    AND (_end_date   IS NULL OR e.lead_at <= _end_date)
    AND (_owner_id   IS NULL OR e.commercial_owner_id = _owner_id)
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

COMMENT ON FUNCTION public.sales_kpis_cohorts(timestamptz, timestamptz, uuid) IS
  'Coortes mensais filtradas por período (lead_at) e vendedora.';

-- ------------------------------------------------------------
-- 4. Motivos de perda (filtrados)
-- ------------------------------------------------------------
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    blr.reason_category                                                  AS reason,
    COUNT(*)::bigint                                                     AS qty,
    ROUND(100.0 * COUNT(*)::numeric
         / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)                          AS pct_of_lost,
    COALESCE(SUM(eb.total_value), 0)::numeric                            AS revenue_lost,
    ROUND(AVG(eb.total_value)::numeric, 2)                               AS avg_deal_size,
    COALESCE(SUM(blr.competitor_value), 0)::numeric                      AS competitor_value_total
  FROM public.budget_lost_reasons blr
  LEFT JOIN public.v_sales_budgets_enriched eb ON eb.id = blr.budget_id
  WHERE (_start_date IS NULL OR eb.lead_at >= _start_date)
    AND (_end_date   IS NULL OR eb.lead_at <= _end_date)
    AND (_owner_id   IS NULL OR eb.commercial_owner_id = _owner_id)
  GROUP BY blr.reason_category
  ORDER BY qty DESC;
$$;

COMMENT ON FUNCTION public.sales_kpis_lost_reasons(timestamptz, timestamptz, uuid) IS
  'Ranking de motivos de perda, filtrado por período (lead_at) e vendedora.';

-- ------------------------------------------------------------
-- 5. Conversão por segmento — versão filtrada
-- A função antiga `sales_conversion_by_segment(text)` é mantida
-- (callers legados não quebram). Esta nova aceita filtros.
-- ------------------------------------------------------------
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
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF _dimension NOT IN ('metragem','location_type','property_type','lead_source') THEN
    RAISE EXCEPTION 'Dimensão inválida: %. Use metragem | location_type | property_type | lead_source.', _dimension;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT
      COALESCE(%I, 'não informado')::text                              AS segment,
      COUNT(*)::bigint                                                  AS total_leads,
      COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::bigint         AS proposals_sent,
      COUNT(*) FILTER (WHERE is_won)::bigint                            AS deals_won,
      COUNT(*) FILTER (WHERE is_lost)::bigint                           AS deals_lost,
      COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost)::bigint        AS deals_open,
      CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
           THEN ROUND(
             100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
                  / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
           ELSE 0 END                                                    AS win_rate_pct,
      CASE WHEN COUNT(*) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
           ELSE 0 END                                                    AS proposal_rate_pct,
      ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
      ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2)         AS avg_deal_size_won,
      COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric      AS revenue_won
    FROM public.v_sales_budgets_enriched
    WHERE ($1 IS NULL OR lead_at >= $1)
      AND ($2 IS NULL OR lead_at <= $2)
      AND ($3 IS NULL OR commercial_owner_id = $3)
    GROUP BY 1
    ORDER BY total_leads DESC
  $q$,
    CASE _dimension
      WHEN 'metragem' THEN 'metragem_bucket'
      ELSE _dimension
    END
  )
  USING _start_date, _end_date, _owner_id;
END;
$$;

COMMENT ON FUNCTION public.sales_conversion_by_segment(text, timestamptz, timestamptz, uuid) IS
  'Conversão e ciclo por segmento, filtrados por período e vendedora.';

-- ------------------------------------------------------------
-- 6. Permissões
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.sales_kpis_by_owner(timestamptz, timestamptz)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_time_in_stage(timestamptz, timestamptz, uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_cohorts(timestamptz, timestamptz, uuid)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_lost_reasons(timestamptz, timestamptz, uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_conversion_by_segment(text, timestamptz, timestamptz, uuid)          TO authenticated;
