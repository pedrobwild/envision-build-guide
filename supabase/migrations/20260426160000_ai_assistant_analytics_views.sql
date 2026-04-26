-- ai_assistant_analytics_views.sql
--
-- Views auxiliares para o assistente de IA (ai-assistant-chat).
-- Não são *necessárias* — as tools agregam em memória — mas aceleram
-- perguntas frequentes e podem ser consumidas pelo Dashboard Admin.
--
-- Todas são SECURITY INVOKER (default) e ENABLE ROW LEVEL SECURITY = ON
-- via tabelas-base. Criamos como views simples; quem consulta segue RLS
-- da tabela budgets/clients/lead_sources.

-- ─── 1. Média diária de orçamentos criados (últimos 90 dias) ──────────
CREATE OR REPLACE VIEW public.v_ai_budgets_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*)::int                       AS budgets_created,
  COUNT(*) FILTER (WHERE internal_status = 'contrato_fechado')::int AS budgets_won,
  COUNT(*) FILTER (WHERE internal_status = 'perdido')::int          AS budgets_lost,
  COALESCE(SUM(internal_cost), 0)::numeric  AS sum_internal_cost,
  COALESCE(SUM(manual_total), 0)::numeric   AS sum_manual_total,
  COALESCE(AVG(internal_cost), 0)::numeric  AS avg_internal_cost
FROM public.budgets
WHERE created_at >= now() - interval '90 days'
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW public.v_ai_budgets_daily IS
  'Série diária dos últimos 90 dias para uso pelo assistente de IA e dashboards. Respeita RLS de budgets.';

-- ─── 2. Conversão semanal (week-over-week) ─────────────────────────────
CREATE OR REPLACE VIEW public.v_ai_conversion_weekly AS
WITH weeks AS (
  SELECT
    date_trunc('week', created_at)::date AS week_start,
    COUNT(*)                            AS received,
    COUNT(*) FILTER (WHERE internal_status = 'contrato_fechado') AS won,
    COUNT(*) FILTER (WHERE internal_status = 'perdido')           AS lost
  FROM public.budgets
  WHERE created_at >= now() - interval '180 days'
  GROUP BY 1
)
SELECT
  week_start,
  received::int,
  won::int,
  lost::int,
  CASE WHEN received > 0
    THEN round((won::numeric / received) * 100, 2)
    ELSE 0 END AS conversion_rate_pct
FROM weeks
ORDER BY week_start DESC;

COMMENT ON VIEW public.v_ai_conversion_weekly IS
  'Taxa de conversão semanal (won / received) dos últimos 180 dias.';

-- ─── 3. Leads por origem (últimos 30 dias) ─────────────────────────────
CREATE OR REPLACE VIEW public.v_ai_leads_by_source AS
SELECT
  source,
  COUNT(*)::int                                                 AS total_leads,
  COUNT(*) FILTER (WHERE processing_status = 'processed')::int  AS processed,
  COUNT(*) FILTER (WHERE processing_status = 'duplicate')::int  AS duplicates,
  COUNT(*) FILTER (WHERE processing_status = 'failed')::int     AS failed,
  COUNT(DISTINCT campaign_name) FILTER (WHERE campaign_name IS NOT NULL)::int AS campaigns,
  MIN(received_at) AS first_received,
  MAX(received_at) AS last_received
FROM public.lead_sources
WHERE received_at >= now() - interval '30 days'
GROUP BY source
ORDER BY total_leads DESC;

COMMENT ON VIEW public.v_ai_leads_by_source IS
  'Resumo de leads recebidos por origem (Meta/Google/site/manual) nos últimos 30 dias.';

-- ─── 4. Top clientes por receita (últimos 365 dias) ────────────────────
CREATE OR REPLACE VIEW public.v_ai_top_clients_revenue AS
SELECT
  c.id            AS client_id,
  c.name          AS client_name,
  c.city,
  COUNT(b.id)::int                            AS won_budgets,
  COALESCE(SUM(b.manual_total), 0)::numeric   AS total_revenue_brl,
  COALESCE(AVG(b.manual_total), 0)::numeric   AS avg_ticket_brl,
  MAX(b.approved_at)                          AS last_won_at
FROM public.clients c
JOIN public.budgets b ON b.client_id = c.id
WHERE b.internal_status IN ('contrato_fechado', 'minuta_solicitada')
  AND b.approved_at >= now() - interval '365 days'
GROUP BY c.id, c.name, c.city
ORDER BY total_revenue_brl DESC;

COMMENT ON VIEW public.v_ai_top_clients_revenue IS
  'Top clientes por receita aprovada nos últimos 365 dias.';

-- ─── 5. Snapshot mais recente do funil ─────────────────────────────────
CREATE OR REPLACE VIEW public.v_ai_funnel_snapshot AS
SELECT
  internal_status,
  COUNT(*)::int                                 AS qty,
  COALESCE(SUM(internal_cost), 0)::numeric      AS portfolio_internal_cost,
  COALESCE(SUM(manual_total), 0)::numeric       AS portfolio_manual_total,
  COUNT(*) FILTER (WHERE due_at < now())::int   AS overdue_qty
FROM public.budgets
WHERE internal_status NOT IN ('perdido', 'contrato_fechado')
GROUP BY internal_status
ORDER BY qty DESC;

COMMENT ON VIEW public.v_ai_funnel_snapshot IS
  'Funil atual (excluindo fechados/perdidos) por internal_status.';
