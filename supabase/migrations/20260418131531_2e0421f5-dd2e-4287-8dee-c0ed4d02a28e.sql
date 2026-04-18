-- Recreate client_stats view with latest_internal_status to derive client funnel stage
DROP VIEW IF EXISTS public.client_stats;

CREATE VIEW public.client_stats AS
WITH latest_budget AS (
  SELECT DISTINCT ON (b_1.client_id)
    b_1.client_id,
    b_1.internal_status AS latest_internal_status,
    COALESCE(b_1.manual_total, (
      SELECT COALESCE(sum(s.section_price), 0::numeric)
      FROM sections s
      WHERE s.budget_id = b_1.id
    )) AS latest_total
  FROM budgets b_1
  WHERE b_1.client_id IS NOT NULL
  ORDER BY b_1.client_id, b_1.created_at DESC
)
SELECT
  c.id AS client_id,
  count(b.id) AS total_budgets,
  count(b.id) FILTER (WHERE b.internal_status <> ALL (ARRAY['contrato_fechado'::text, 'lost'::text, 'archived'::text])) AS active_budgets,
  count(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado'::text) AS won_budgets,
  COALESCE(sum(
    CASE
      WHEN b.internal_status = 'contrato_fechado'::text THEN COALESCE(b.manual_total, 0::numeric)
      ELSE 0::numeric
    END), 0::numeric) AS total_won_value,
  COALESCE(lb.latest_total, 0::numeric) AS pipeline_value,
  CASE
    WHEN count(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado'::text) > 0 THEN
      COALESCE(sum(
        CASE
          WHEN b.internal_status = 'contrato_fechado'::text THEN b.manual_total
          ELSE 0::numeric
        END), 0::numeric) / count(b.id) FILTER (WHERE b.internal_status = 'contrato_fechado'::text)::numeric
    ELSE NULL::numeric
  END AS avg_ticket,
  max(b.created_at) AS last_budget_at,
  lb.latest_internal_status
FROM clients c
LEFT JOIN budgets b ON b.client_id = c.id
LEFT JOIN latest_budget lb ON lb.client_id = c.id
GROUP BY c.id, lb.latest_total, lb.latest_internal_status;