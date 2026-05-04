-- ============================================================
-- Paridade Views x RPCs — Sales KPIs
--
-- Compara as views "antigas" (sem filtro) das migrations
-- 20260501041500_sales_kpis_godmode.sql contra as novas RPCs
-- parametrizadas. Quando chamadas SEM filtro (NULL, NULL, NULL),
-- elas DEVEM produzir os mesmos totais.
--
-- Também valida invariantes cruzados quando filtros estão
-- aplicados (período + vendedora).
--
-- Uso:
--   psql -f scripts/test-sales-kpis-parity.sql
--
-- Cada bloco retorna 1 linha com `status` = 'PASS' ou 'FAIL'.
-- Se aparecer qualquer 'FAIL', há divergência entre as duas
-- camadas — investigue antes de promover.
-- ============================================================

\echo '— 1. by_owner: view vs RPC sem filtro'
WITH v AS (
  SELECT COUNT(*)::bigint AS rows,
         COALESCE(SUM(total_leads),0)::bigint AS leads,
         COALESCE(SUM(deals_won),0)::bigint AS won,
         COALESCE(ROUND(SUM(revenue_won)::numeric, 2), 0) AS revenue
  FROM public.v_sales_cycle_by_owner
), r AS (
  SELECT COUNT(*)::bigint AS rows,
         COALESCE(SUM(total_leads),0)::bigint AS leads,
         COALESCE(SUM(deals_won),0)::bigint AS won,
         COALESCE(ROUND(SUM(revenue_won)::numeric, 2), 0) AS revenue
  FROM public.sales_kpis_by_owner(NULL, NULL)
)
SELECT CASE
  WHEN v.rows = r.rows AND v.leads = r.leads AND v.won = r.won AND v.revenue = r.revenue
  THEN 'PASS' ELSE 'FAIL' END AS status,
  v.rows AS view_rows, r.rows AS rpc_rows,
  v.leads AS view_leads, r.leads AS rpc_leads,
  v.won AS view_won, r.won AS rpc_won,
  v.revenue AS view_revenue, r.revenue AS rpc_revenue
FROM v, r;

\echo '— 2. time_in_stage: view vs RPC sem filtro'
WITH v AS (
  SELECT COUNT(*)::bigint AS stages, COALESCE(SUM(sample_size),0)::bigint AS samples
  FROM public.v_sales_time_in_stage
), r AS (
  SELECT COUNT(*)::bigint AS stages, COALESCE(SUM(sample_size),0)::bigint AS samples
  FROM public.sales_kpis_time_in_stage(NULL, NULL, NULL)
)
SELECT CASE WHEN v.stages = r.stages AND v.samples = r.samples THEN 'PASS' ELSE 'FAIL' END AS status,
  v.stages AS view_stages, r.stages AS rpc_stages,
  v.samples AS view_samples, r.samples AS rpc_samples
FROM v, r;

\echo '— 3. cohorts: view vs RPC sem filtro'
WITH v AS (
  SELECT COUNT(*)::bigint AS months, COALESCE(SUM(leads),0)::bigint AS leads,
         COALESCE(SUM(deals_won),0)::bigint AS won,
         COALESCE(ROUND(SUM(revenue_won)::numeric, 2),0) AS revenue
  FROM public.v_sales_cohort_monthly
), r AS (
  SELECT COUNT(*)::bigint AS months, COALESCE(SUM(leads),0)::bigint AS leads,
         COALESCE(SUM(deals_won),0)::bigint AS won,
         COALESCE(ROUND(SUM(revenue_won)::numeric, 2),0) AS revenue
  FROM public.sales_kpis_cohorts(NULL, NULL, NULL)
)
SELECT CASE
  WHEN v.months = r.months AND v.leads = r.leads AND v.won = r.won AND v.revenue = r.revenue
  THEN 'PASS' ELSE 'FAIL' END AS status,
  v.months, r.months, v.leads, r.leads, v.won, r.won, v.revenue, r.revenue
FROM v, r;

\echo '— 4. lost_reasons: view vs RPC sem filtro'
WITH v AS (
  SELECT COUNT(*)::bigint AS reasons, COALESCE(SUM(qty),0)::bigint AS qty,
         COALESCE(ROUND(SUM(revenue_lost)::numeric, 2),0) AS revenue
  FROM public.v_sales_lost_reasons_ranked
), r AS (
  SELECT COUNT(*)::bigint AS reasons, COALESCE(SUM(qty),0)::bigint AS qty,
         COALESCE(ROUND(SUM(revenue_lost)::numeric, 2),0) AS revenue
  FROM public.sales_kpis_lost_reasons(NULL, NULL, NULL)
)
SELECT CASE
  WHEN v.reasons = r.reasons AND v.qty = r.qty AND v.revenue = r.revenue
  THEN 'PASS' ELSE 'FAIL' END AS status,
  v.reasons, r.reasons, v.qty, r.qty, v.revenue, r.revenue
FROM v, r;

\echo '— 5. Consistência cruzada: by_owner.total_leads = soma cohorts(owner).leads'
WITH owners AS (
  SELECT owner_id, total_leads
  FROM public.sales_kpis_by_owner(NULL, NULL)
  WHERE owner_id IS NOT NULL
),
cross_check AS (
  SELECT o.owner_id,
         o.total_leads AS by_owner_leads,
         COALESCE((SELECT SUM(leads) FROM public.sales_kpis_cohorts(NULL, NULL, o.owner_id)), 0)::bigint AS cohort_leads
  FROM owners o
)
SELECT CASE WHEN COUNT(*) FILTER (WHERE by_owner_leads <> cohort_leads) = 0
            THEN 'PASS' ELSE 'FAIL' END AS status,
       COUNT(*) AS owners_checked,
       COUNT(*) FILTER (WHERE by_owner_leads <> cohort_leads) AS divergences
FROM cross_check;

\echo '— 6. Filtro de período reduz (ou mantém) o total — nunca aumenta'
WITH all_leads AS (
  SELECT COALESCE(SUM(total_leads),0)::bigint AS n FROM public.sales_kpis_by_owner(NULL, NULL)
),
last_30d AS (
  SELECT COALESCE(SUM(total_leads),0)::bigint AS n
  FROM public.sales_kpis_by_owner(now() - interval '30 days', now())
)
SELECT CASE WHEN last_30d.n <= all_leads.n THEN 'PASS' ELSE 'FAIL' END AS status,
  all_leads.n AS all_time_leads, last_30d.n AS last_30d_leads
FROM all_leads, last_30d;

\echo '— 7. Filtro de owner em segment retorna apenas leads daquela vendedora'
WITH owners AS (
  SELECT owner_id, total_leads
  FROM public.sales_kpis_by_owner(NULL, NULL)
  WHERE owner_id IS NOT NULL
  ORDER BY total_leads DESC LIMIT 1
),
seg AS (
  SELECT COALESCE(SUM(total_leads),0)::bigint AS n
  FROM public.sales_conversion_by_segment('metragem', NULL, NULL,
    (SELECT owner_id FROM owners))
)
SELECT CASE WHEN seg.n = owners.total_leads THEN 'PASS' ELSE 'FAIL' END AS status,
  owners.owner_id, owners.total_leads AS by_owner_leads, seg.n AS segment_leads
FROM owners, seg;
