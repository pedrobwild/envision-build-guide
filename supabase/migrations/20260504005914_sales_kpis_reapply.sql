-- ============================================================
-- Sales KPIs — Re-aplicação idempotente das RPCs
--
-- Contexto: a página /admin/comercial/kpis começou a renderizar
-- vazia em produção. A causa raiz foi que as RPCs criadas em
-- 20260501041500_sales_kpis_godmode.sql e
-- 20260501230000_sales_kpis_filtered.sql não tinham sido
-- aplicadas no banco — `src/integrations/supabase/types.ts` não
-- referencia nenhuma delas, e os hooks (que usam `supabase as any`)
-- chamavam funções inexistentes, fazendo o PostgREST devolver 404.
--
-- Esta migration é uma rede de segurança: re-emite todas as
-- RPCs com `CREATE OR REPLACE`, garantindo que um `supabase db
-- push` reaplique tudo de forma idempotente sem depender de a
-- primeira aplicação ter chegado em produção.
--
-- A view base `v_sales_budgets_enriched` é re-emitida porque
-- todas as RPCs dependem dela.
-- ============================================================

-- ------------------------------------------------------------
-- View base: 1 linha por orçamento, com total e datas do funil
-- (espelha 20260501041500_sales_kpis_godmode.sql)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_budgets_enriched AS
WITH totals AS (
  SELECT id, total FROM public.get_budget_totals()
),
lead_in AS (
  SELECT
    be.budget_id,
    MIN(be.created_at) AS lead_at
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
             THEN be.created_at END)                                          AS first_sent_at
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
  b.location_type,
  b.property_type,
  COALESCE(b.property_metragem, b.metragem)         AS metragem_raw,
  public.parse_metragem_m2(COALESCE(b.property_metragem, b.metragem)) AS metragem_m2,
  public.metragem_bucket(public.parse_metragem_m2(COALESCE(b.property_metragem, b.metragem))) AS metragem_bucket,
  COALESCE(t.total, 0)::numeric                     AS total_value,
  COALESCE(li.lead_at, b.created_at)                AS lead_at,
  ti.first_sent_at,
  ti.won_at,
  ti.lost_at,
  public.is_won_status(b.internal_status)           AS is_won,
  public.is_lost_status(b.internal_status)          AS is_lost,
  CASE
    WHEN public.is_won_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.won_at,  b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    WHEN public.is_lost_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.lost_at, b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    ELSE NULL
  END                                               AS cycle_days,
  CASE
    WHEN public.is_won_status(b.internal_status) OR public.is_lost_status(b.internal_status)
      THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - COALESCE(li.lead_at, b.created_at))) / 86400.0
  END                                               AS open_days
FROM public.budgets b
LEFT JOIN totals      t  ON t.id  = b.id
LEFT JOIN lead_in     li ON li.budget_id   = b.id
LEFT JOIN terminal_in ti ON ti.budget_id   = b.id;

GRANT SELECT ON public.v_sales_budgets_enriched TO authenticated;

-- ------------------------------------------------------------
-- 1. Overview macro (RPC consolidada)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_kpis_dashboard(
  _start_date timestamptz DEFAULT NULL,
  _end_date   timestamptz DEFAULT NULL,
  _owner_id   uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  WITH scoped AS (
    SELECT * FROM public.v_sales_budgets_enriched
    WHERE (_start_date IS NULL OR lead_at >= _start_date)
      AND (_end_date   IS NULL OR lead_at <= _end_date)
      AND (_owner_id   IS NULL OR commercial_owner_id = _owner_id)
  ),
  overview AS (
    SELECT
      COUNT(*)                                                      AS total_leads,
      COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)             AS proposals_sent,
      COUNT(*) FILTER (WHERE is_won)                                AS deals_won,
      COUNT(*) FILTER (WHERE is_lost)                               AS deals_lost,
      COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost)            AS deals_open,
      CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
                    / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
           ELSE 0 END                                                AS win_rate_pct,
      CASE WHEN COUNT(*) > 0
           THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
           ELSE 0 END                                                AS proposal_rate_pct,
      ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1)  AS avg_cycle_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days)        AS p50_cycle_days,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cycle_days)        AS p90_cycle_days,
      ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2)      AS avg_deal_size_won,
      COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric   AS revenue_won,
      COALESCE(SUM(total_value) FILTER (WHERE is_lost), 0)::numeric  AS revenue_lost,
      COALESCE(SUM(total_value) FILTER (WHERE NOT is_won AND NOT is_lost), 0)::numeric AS pipeline_open_value
    FROM scoped
  )
  SELECT to_jsonb(overview.*) INTO _result FROM overview;

  RETURN _result;
END;
$$;

-- ------------------------------------------------------------
-- 2. Performance por vendedora (filtrada por período)
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

-- ------------------------------------------------------------
-- 3. Tempo médio em cada etapa (filtrado)
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

-- ------------------------------------------------------------
-- 4. Coortes mensais (filtradas)
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

-- ------------------------------------------------------------
-- 5. Motivos de perda (filtrados)
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

-- ------------------------------------------------------------
-- 6. Conversão por segmento — overload com filtros
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

-- ------------------------------------------------------------
-- Permissões (idempotentes)
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.sales_kpis_dashboard(timestamptz, timestamptz, uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_by_owner(timestamptz, timestamptz)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_time_in_stage(timestamptz, timestamptz, uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_cohorts(timestamptz, timestamptz, uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_lost_reasons(timestamptz, timestamptz, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_conversion_by_segment(text, timestamptz, timestamptz, uuid)     TO authenticated;
