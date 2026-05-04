-- ============================================================
-- Sales KPIs — God Mode
-- Camada analítica para o dashboard de operação de vendas:
-- macro (overview) → micro (por vendedora, etapa, faixa de m²,
-- tipo de locação, tipo de imóvel, fonte e coortes mensais).
--
-- Reaproveita: budgets, budget_events, budget_lost_reasons,
-- deal_pipelines, get_budget_totals().
--
-- Tudo é VIEW + função STABLE em search_path=public, com SECURITY
-- INVOKER (respeita RLS de quem chama). O front consome via
-- supabase.from('v_*') ou .rpc('sales_kpis_*').
-- ============================================================

-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------

-- Extrai o primeiro número (em m²) de campos texto-livre como
-- "85 m²", "120m2", "60 a 80", "≈ 100".
CREATE OR REPLACE FUNCTION public.parse_metragem_m2(_raw text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    regexp_replace(
      COALESCE((regexp_match(COALESCE(_raw, ''), '([0-9]+[.,]?[0-9]*)'))[1], ''),
      ',', '.'
    ),
    ''
  )::numeric
$$;

-- Classifica metragem em faixas de mercado (BWild padrão STR).
CREATE OR REPLACE FUNCTION public.metragem_bucket(_m2 numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _m2 IS NULL          THEN 'não informado'
    WHEN _m2 <= 50            THEN '≤ 50 m²'
    WHEN _m2 <= 100           THEN '51–100 m²'
    WHEN _m2 <= 200           THEN '101–200 m²'
    WHEN _m2 <= 400           THEN '201–400 m²'
    ELSE                            '400+ m²'
  END
$$;

-- Status terminal: orçamento saiu do funil ativo.
CREATE OR REPLACE FUNCTION public.is_won_status(_s text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s = 'contrato_fechado'
$$;

CREATE OR REPLACE FUNCTION public.is_lost_status(_s text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _s IN ('lost','perdido')
$$;

-- ------------------------------------------------------------
-- 1. Base unificada: tudo que precisamos por orçamento
-- ------------------------------------------------------------
-- Materializa os totais via get_budget_totals() e enriquece com
-- tempo de fechamento (lead_at → won/lost_at).
CREATE OR REPLACE VIEW public.v_sales_budgets_enriched AS
WITH totals AS (
  SELECT id, total FROM public.get_budget_totals()
),
-- Primeiro evento "lead" (entrada no funil). Fallback: created_at.
lead_in AS (
  SELECT
    be.budget_id,
    MIN(be.created_at) AS lead_at
  FROM public.budget_events be
  WHERE be.event_type = 'status_change'
  GROUP BY be.budget_id
),
-- Quando virou contrato_fechado / perdido (último carimbo).
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
  -- Estado terminal
  public.is_won_status(b.internal_status)           AS is_won,
  public.is_lost_status(b.internal_status)          AS is_lost,
  -- Dias no ciclo (lead → won/lost). NULL se ainda em andamento.
  CASE
    WHEN public.is_won_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.won_at,  b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    WHEN public.is_lost_status(b.internal_status)
      THEN EXTRACT(EPOCH FROM (COALESCE(ti.lost_at, b.updated_at) - COALESCE(li.lead_at, b.created_at))) / 86400.0
    ELSE NULL
  END                                               AS cycle_days,
  -- Dias em aberto (para deals ativos)
  CASE
    WHEN public.is_won_status(b.internal_status) OR public.is_lost_status(b.internal_status)
      THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - COALESCE(li.lead_at, b.created_at))) / 86400.0
  END                                               AS open_days
FROM public.budgets b
LEFT JOIN totals      t  ON t.id  = b.id
LEFT JOIN lead_in     li ON li.budget_id   = b.id
LEFT JOIN terminal_in ti ON ti.budget_id   = b.id;

COMMENT ON VIEW public.v_sales_budgets_enriched IS
  'Base de fato para KPIs de vendas: 1 linha por orçamento, com total computado, datas de funil e cycle_days.';

-- ------------------------------------------------------------
-- 2. Overview macro
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_kpis_overview AS
SELECT
  COUNT(*)                                                          AS total_leads,
  COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)                 AS proposals_sent,
  COUNT(*) FILTER (WHERE is_won)                                    AS deals_won,
  COUNT(*) FILTER (WHERE is_lost)                                   AS deals_lost,
  COUNT(*) FILTER (WHERE NOT is_won AND NOT is_lost)                AS deals_open,
  -- Win rate sobre fechados (won / (won + lost))
  CASE WHEN COUNT(*) FILTER (WHERE is_won OR is_lost) > 0
       THEN ROUND(
         100.0 * COUNT(*) FILTER (WHERE is_won)::numeric
              / COUNT(*) FILTER (WHERE is_won OR is_lost), 2)
       ELSE 0 END                                                   AS win_rate_pct,
  -- Win rate sobre todos os leads
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric / COUNT(*), 2)
       ELSE 0 END                                                   AS lead_to_won_pct,
  -- % de leads que receberam proposta
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)::numeric / COUNT(*), 2)
       ELSE 0 END                                                   AS proposal_rate_pct,
  -- Ticket médio fechado
  ROUND(AVG(total_value) FILTER (WHERE is_won)::numeric, 2)         AS avg_deal_size_won,
  -- Receita fechada no período
  COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric      AS revenue_won,
  -- Receita perdida (potencial não capturado)
  COALESCE(SUM(total_value) FILTER (WHERE is_lost), 0)::numeric     AS revenue_lost,
  -- Pipeline aberto (em andamento)
  COALESCE(SUM(total_value) FILTER (WHERE NOT is_won AND NOT is_lost), 0)::numeric AS pipeline_open_value,
  -- Ciclo médio (dias) — apenas deals concluídos
  ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
  -- p50 / p90 ciclo
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days)            AS p50_cycle_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cycle_days)            AS p90_cycle_days
FROM public.v_sales_budgets_enriched;

COMMENT ON VIEW public.v_sales_kpis_overview IS
  'KPIs macro de vendas: leads, propostas, win rate, ticket médio, receita, ciclo p50/p90.';

-- ------------------------------------------------------------
-- 3. Performance por vendedora
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_cycle_by_owner AS
SELECT
  e.commercial_owner_id                                              AS owner_id,
  COALESCE(p.email, 'sem_dono')                                      AS owner_email,
  COALESCE(p.full_name, p.email, 'Sem responsável')                  AS owner_name,
  COUNT(*)                                                           AS total_leads,
  COUNT(*) FILTER (WHERE e.first_sent_at IS NOT NULL)                AS proposals_sent,
  COUNT(*) FILTER (WHERE e.is_won)                                   AS deals_won,
  COUNT(*) FILTER (WHERE e.is_lost)                                  AS deals_lost,
  COUNT(*) FILTER (WHERE NOT e.is_won AND NOT e.is_lost)             AS deals_open,
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
GROUP BY e.commercial_owner_id, p.email, p.full_name;

COMMENT ON VIEW public.v_sales_cycle_by_owner IS
  'KPIs por vendedora: volume, win rate, ciclo p50/p90, ticket médio, pipeline em aberto.';

-- ------------------------------------------------------------
-- 4. Tempo médio em cada etapa do pipeline
-- ------------------------------------------------------------
-- Para cada (budget, etapa) calcula o intervalo entre a entrada
-- na etapa e o próximo evento de mudança (ou now() se ainda lá).
CREATE OR REPLACE VIEW public.v_sales_time_in_stage AS
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
),
stage_durations AS (
  SELECT
    budget_id,
    commercial_owner_id,
    stage,
    EXTRACT(EPOCH FROM (COALESCE(exited_at, now()) - entered_at)) / 86400.0 AS days_in_stage,
    entered_at
  FROM ordered
)
SELECT
  stage,
  COUNT(*)                                                        AS sample_size,
  ROUND(AVG(days_in_stage)::numeric, 1)                           AS avg_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_in_stage)      AS p50_days,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY days_in_stage)      AS p90_days,
  MIN(days_in_stage)                                              AS min_days,
  MAX(days_in_stage)                                              AS max_days
FROM stage_durations
GROUP BY stage
ORDER BY avg_days DESC NULLS LAST;

COMMENT ON VIEW public.v_sales_time_in_stage IS
  'Quantos dias o negócio passou em cada etapa do pipeline (avg/p50/p90).';

-- ------------------------------------------------------------
-- 5. Conversão por segmento (m², tipo de locação, imóvel, fonte)
-- ------------------------------------------------------------
-- Função genérica que retorna conversão+ciclo para qualquer
-- dimensão. Frente única, segmentos diferentes.
CREATE OR REPLACE FUNCTION public.sales_conversion_by_segment(_dimension text)
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
    GROUP BY 1
    ORDER BY total_leads DESC
  $q$,
    CASE _dimension
      WHEN 'metragem' THEN 'metragem_bucket'
      ELSE _dimension
    END
  );
END;
$$;

COMMENT ON FUNCTION public.sales_conversion_by_segment(text) IS
  'Conversão e ciclo por segmento. Dimensões: metragem | location_type | property_type | lead_source.';

-- ------------------------------------------------------------
-- 6. Coortes mensais (mês de entrada do lead)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_cohort_monthly AS
SELECT
  date_trunc('month', lead_at)::date                                  AS cohort_month,
  COUNT(*)                                                            AS leads,
  COUNT(*) FILTER (WHERE first_sent_at IS NOT NULL)                   AS proposals_sent,
  COUNT(*) FILTER (WHERE is_won)                                      AS deals_won,
  COUNT(*) FILTER (WHERE is_lost)                                     AS deals_lost,
  CASE WHEN COUNT(*) > 0
       THEN ROUND(100.0 * COUNT(*) FILTER (WHERE is_won)::numeric / COUNT(*), 2)
       ELSE 0 END                                                     AS lead_to_won_pct,
  ROUND(AVG(cycle_days) FILTER (WHERE cycle_days IS NOT NULL)::numeric, 1) AS avg_cycle_days,
  COALESCE(SUM(total_value) FILTER (WHERE is_won), 0)::numeric        AS revenue_won
FROM public.v_sales_budgets_enriched
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW public.v_sales_cohort_monthly IS
  'Coortes mensais de leads, com taxa de conversão acumulada e receita fechada.';

-- ------------------------------------------------------------
-- 7. Ranking de motivos de perda
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_lost_reasons_ranked AS
SELECT
  blr.reason_category                                                  AS reason,
  COUNT(*)                                                             AS qty,
  ROUND(100.0 * COUNT(*)::numeric
       / NULLIF(SUM(COUNT(*)) OVER (), 0), 2)                          AS pct_of_lost,
  COALESCE(SUM(eb.total_value), 0)::numeric                            AS revenue_lost,
  ROUND(AVG(eb.total_value)::numeric, 2)                               AS avg_deal_size,
  COALESCE(SUM(blr.competitor_value), 0)::numeric                      AS competitor_value_total
FROM public.budget_lost_reasons blr
LEFT JOIN public.v_sales_budgets_enriched eb ON eb.id = blr.budget_id
GROUP BY blr.reason_category
ORDER BY qty DESC;

COMMENT ON VIEW public.v_sales_lost_reasons_ranked IS
  'Top motivos de perda com volume, % e valor financeiro associado.';

-- ------------------------------------------------------------
-- 8. RPC consolidada (uma única chamada do front)
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

COMMENT ON FUNCTION public.sales_kpis_dashboard(timestamptz, timestamptz, uuid) IS
  'KPIs consolidados de vendas com filtros de período e owner. Retorna JSON único.';

-- ------------------------------------------------------------
-- 9. Permissões (respeita RLS de budgets/budget_events)
-- ------------------------------------------------------------
GRANT SELECT ON public.v_sales_budgets_enriched   TO authenticated;
GRANT SELECT ON public.v_sales_kpis_overview      TO authenticated;
GRANT SELECT ON public.v_sales_cycle_by_owner     TO authenticated;
GRANT SELECT ON public.v_sales_time_in_stage      TO authenticated;
GRANT SELECT ON public.v_sales_cohort_monthly     TO authenticated;
GRANT SELECT ON public.v_sales_lost_reasons_ranked TO authenticated;

GRANT EXECUTE ON FUNCTION public.parse_metragem_m2(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.metragem_bucket(numeric)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_won_status(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lost_status(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_conversion_by_segment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_kpis_dashboard(timestamptz, timestamptz, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 10. Índices de apoio (idempotentes)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS budget_events_budget_created_idx
  ON public.budget_events (budget_id, created_at);

CREATE INDEX IF NOT EXISTS budgets_internal_status_idx
  ON public.budgets (internal_status);

CREATE INDEX IF NOT EXISTS budgets_owner_idx
  ON public.budgets (commercial_owner_id);

-- ------------------------------------------------------------
-- 11. Reload PostgREST schema cache
-- Sem isso, novas funções/views ficam invisíveis por alguns segundos
-- após o deploy (PostgREST cacheia o schema do Postgres).
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
