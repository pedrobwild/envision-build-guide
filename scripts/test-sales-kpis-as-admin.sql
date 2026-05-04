-- ============================================================
-- Paridade real das RPCs do Sales KPIs autenticado como admin
--
-- Roda cada RPC com várias combinações de filtros (período x owner)
-- e compara totais entre si para detectar divergências.
--
-- Uso:
--   ADMIN_USER_ID=<uuid> psql -v admin_id="'$ADMIN_USER_ID'" \
--     -f scripts/test-sales-kpis-as-admin.sql
--
-- Se admin_id não for passado, escolhe o primeiro user_roles.role='admin'.
-- Cada bloco imprime status PASS/FAIL + métricas para inspeção visual.
-- ============================================================

\set ON_ERROR_STOP on
\timing on

-- 1. Resolver admin_id (parâmetro ou primeiro admin disponível)
\if :{?admin_id}
\else
  SELECT user_id::text AS admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  ORDER BY user_id
  LIMIT 1 \gset
\endif

\echo '— Autenticando como admin:' :admin_id

-- 2. Simular sessão autenticada do PostgREST
SELECT set_config('role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'admin_id',
    'role', 'authenticated',
    'email', 'admin-test@bwild.local'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

-- Sanidade: auth.uid() resolvido?
SELECT auth.uid() AS resolved_uid, public.has_role(auth.uid(), 'admin'::public.app_role) AS is_admin;

-- 3. Combinações de filtros para testar
--    NULL/NULL = tudo;  últimos 30d; últimos 90d
--    owner = NULL (todas) e owner = top vendedora
\set range_start_30 '(now() - interval ''30 days'')'
\set range_start_90 '(now() - interval ''90 days'')'

-- Top owner (mais leads no histórico)
SELECT owner_id::text AS top_owner
FROM public.sales_kpis_by_owner(NULL, NULL)
WHERE owner_id IS NOT NULL
ORDER BY total_leads DESC NULLS LAST
LIMIT 1 \gset

\echo '— Top owner para teste:' :top_owner

-- ============================================================
-- BLOCO A — Totais por combinação de filtros
-- ============================================================
\echo
\echo '=========================================================='
\echo 'A. dashboard / by_owner / cohorts — totais por filtro'
\echo '=========================================================='

WITH combos(label, start_at, end_at, owner) AS (
  VALUES
    ('all_time / all_owners',          NULL::timestamptz, NULL::timestamptz, NULL::uuid),
    ('all_time / top_owner',           NULL::timestamptz, NULL::timestamptz, :'top_owner'::uuid),
    ('last_30d / all_owners',          now() - interval '30 days', now(), NULL::uuid),
    ('last_30d / top_owner',           now() - interval '30 days', now(), :'top_owner'::uuid),
    ('last_90d / all_owners',          now() - interval '90 days', now(), NULL::uuid),
    ('last_90d / top_owner',           now() - interval '90 days', now(), :'top_owner'::uuid)
)
SELECT
  c.label,
  -- Dashboard (jsonb)
  ((d.payload->'kpis'->>'total_leads'))::bigint        AS dash_leads,
  ((d.payload->'kpis'->>'deals_won'))::bigint          AS dash_won,
  ROUND(((d.payload->'kpis'->>'revenue_won'))::numeric, 2) AS dash_revenue,
  -- Cohorts (somatório)
  coh.cohort_leads,
  coh.cohort_won,
  ROUND(coh.cohort_revenue, 2) AS cohort_revenue,
  -- Comparação interna do mesmo filtro
  CASE
    WHEN ((d.payload->'kpis'->>'total_leads'))::bigint = coh.cohort_leads
     AND ((d.payload->'kpis'->>'deals_won'))::bigint   = coh.cohort_won
    THEN 'PASS' ELSE 'FAIL'
  END AS dashboard_vs_cohorts
FROM combos c
CROSS JOIN LATERAL (
  SELECT public.sales_kpis_dashboard(c.start_at, c.end_at, c.owner) AS payload
) d
CROSS JOIN LATERAL (
  SELECT
    COALESCE(SUM(leads), 0)::bigint        AS cohort_leads,
    COALESCE(SUM(deals_won), 0)::bigint    AS cohort_won,
    COALESCE(SUM(revenue_won), 0)::numeric AS cohort_revenue
  FROM public.sales_kpis_cohorts(c.start_at, c.end_at, c.owner)
) coh;

-- ============================================================
-- BLOCO B — by_owner ignora _owner_id (esperado)
-- ============================================================
\echo
\echo '=========================================================='
\echo 'B. by_owner ignora filtro de owner (mantém ranking inteiro)'
\echo '=========================================================='

WITH a AS (
  SELECT COUNT(*) AS rows, COALESCE(SUM(total_leads),0) AS leads
  FROM public.sales_kpis_by_owner(now() - interval '90 days', now())
)
SELECT a.rows AS owner_rows_90d, a.leads AS total_leads_90d,
       CASE WHEN a.rows >= 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM a;

-- ============================================================
-- BLOCO C — segment respeita owner
-- ============================================================
\echo
\echo '=========================================================='
\echo 'C. conversion_by_segment(owner) ≤ totais sem filtro de owner'
\echo '=========================================================='

WITH all_seg AS (
  SELECT COALESCE(SUM(total_leads), 0)::bigint AS n
  FROM public.sales_conversion_by_segment('metragem', NULL, NULL, NULL)
),
owner_seg AS (
  SELECT COALESCE(SUM(total_leads), 0)::bigint AS n
  FROM public.sales_conversion_by_segment('metragem', NULL, NULL, :'top_owner'::uuid)
)
SELECT all_seg.n AS all_owners_leads,
       owner_seg.n AS top_owner_leads,
       CASE WHEN owner_seg.n <= all_seg.n THEN 'PASS' ELSE 'FAIL' END AS status
FROM all_seg, owner_seg;

-- ============================================================
-- BLOCO D — time_in_stage e lost_reasons reagem ao filtro de owner
-- ============================================================
\echo
\echo '=========================================================='
\echo 'D. time_in_stage e lost_reasons: amostras owner ≤ amostras total'
\echo '=========================================================='

WITH tis_all AS (
  SELECT COALESCE(SUM(sample_size), 0)::bigint AS n
  FROM public.sales_kpis_time_in_stage(NULL, NULL, NULL)
),
tis_owner AS (
  SELECT COALESCE(SUM(sample_size), 0)::bigint AS n
  FROM public.sales_kpis_time_in_stage(NULL, NULL, :'top_owner'::uuid)
),
lr_all AS (
  SELECT COALESCE(SUM(qty), 0)::bigint AS n
  FROM public.sales_kpis_lost_reasons(NULL, NULL, NULL)
),
lr_owner AS (
  SELECT COALESCE(SUM(qty), 0)::bigint AS n
  FROM public.sales_kpis_lost_reasons(NULL, NULL, :'top_owner'::uuid)
)
SELECT
  tis_all.n  AS time_in_stage_total,
  tis_owner.n AS time_in_stage_owner,
  lr_all.n   AS lost_reasons_total,
  lr_owner.n AS lost_reasons_owner,
  CASE WHEN tis_owner.n <= tis_all.n AND lr_owner.n <= lr_all.n
       THEN 'PASS' ELSE 'FAIL' END AS status
FROM tis_all, tis_owner, lr_all, lr_owner;

-- ============================================================
-- BLOCO E — Cross-check: dashboard.total_leads = soma by_owner.total_leads
--           (apenas quando _owner_id é NULL e mesmo período)
-- ============================================================
\echo
\echo '=========================================================='
\echo 'E. dashboard(NULL owner) == SUM(by_owner) no mesmo período'
\echo '=========================================================='

WITH periods(label, start_at, end_at) AS (
  VALUES
    ('all_time',  NULL::timestamptz, NULL::timestamptz),
    ('last_30d',  now() - interval '30 days', now()),
    ('last_90d',  now() - interval '90 days', now())
)
SELECT
  p.label,
  ((d.payload->'kpis'->>'total_leads'))::bigint AS dashboard_leads,
  bo.sum_leads AS by_owner_leads,
  CASE WHEN ((d.payload->'kpis'->>'total_leads'))::bigint = bo.sum_leads
       THEN 'PASS' ELSE 'FAIL' END AS status
FROM periods p
CROSS JOIN LATERAL (
  SELECT public.sales_kpis_dashboard(p.start_at, p.end_at, NULL) AS payload
) d
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(total_leads), 0)::bigint AS sum_leads
  FROM public.sales_kpis_by_owner(p.start_at, p.end_at)
) bo;

-- Encerrar simulação
RESET ROLE;
\echo
\echo '— Fim. Procure por linhas com status = FAIL acima.'
