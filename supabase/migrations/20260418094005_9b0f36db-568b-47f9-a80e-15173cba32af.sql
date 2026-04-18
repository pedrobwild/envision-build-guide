DROP VIEW IF EXISTS public.client_stats CASCADE;

CREATE VIEW public.client_stats WITH (security_invoker = on) AS
WITH latest_budget AS (
  SELECT DISTINCT ON (b.client_id)
    b.client_id,
    COALESCE(
      b.manual_total,
      (SELECT COALESCE(SUM(s.section_price), 0) FROM public.sections s WHERE s.budget_id = b.id)
    ) AS latest_total
  FROM public.budgets b
  WHERE b.client_id IS NOT NULL
  ORDER BY b.client_id, b.created_at DESC
)
SELECT
  c.id AS client_id,
  COUNT(b.id) AS total_budgets,
  COUNT(b.id) FILTER (
    WHERE b.internal_status NOT IN ('contrato_fechado','lost','archived')
  ) AS active_budgets,
  COUNT(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado') AS won_budgets,
  COALESCE(
    SUM(CASE WHEN b.internal_status = 'contrato_fechado' THEN COALESCE(b.manual_total, 0) ELSE 0 END),
    0
  ) AS total_won_value,
  COALESCE(lb.latest_total, 0) AS pipeline_value,
  CASE
    WHEN COUNT(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado') > 0
    THEN COALESCE(SUM(CASE WHEN b.internal_status = 'contrato_fechado' THEN b.manual_total ELSE 0 END), 0)
       / COUNT(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado')
    ELSE NULL
  END AS avg_ticket,
  MAX(b.created_at) AS last_budget_at
FROM public.clients c
LEFT JOIN public.budgets b ON b.client_id = c.id
LEFT JOIN latest_budget lb ON lb.client_id = c.id
GROUP BY c.id, lb.latest_total;