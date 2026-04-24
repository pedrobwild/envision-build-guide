
-- RPC retorna o total calculado por orçamento, replicando exatamente a lógica
-- de calculateSectionSubtotal/calculateBudgetTotal usada no frontend.
-- Objetivo: evitar trafegar 11k+ items via PostgREST no AdminDashboard,
-- que estava gerando "JSON Parse error: Unterminated string" por respostas
-- truncadas em proxies. Agora o cliente recebe apenas (id, total).
CREATE OR REPLACE FUNCTION public.get_budget_totals()
RETURNS TABLE(id uuid, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH item_totals AS (
    SELECT
      s.id AS section_id,
      s.budget_id,
      COALESCE(s.qty, 1) AS section_qty,
      s.section_price,
      SUM(
        CASE
          WHEN COALESCE(i.internal_unit_price, 0) > 0
            THEN COALESCE(i.internal_unit_price, 0)
                 * (1 + COALESCE(i.bdi_percentage, 0) / 100.0)
                 * CASE WHEN COALESCE(i.qty, 0) > 0 THEN i.qty ELSE 1 END
          WHEN COALESCE(i.internal_total, 0) > 0
            THEN COALESCE(i.internal_total, 0)
                 * (1 + COALESCE(i.bdi_percentage, 0) / 100.0)
                 * COALESCE(NULLIF(i.qty, 0), 1)
          ELSE 0
        END
      ) AS items_sum
    FROM public.sections s
    LEFT JOIN public.items i ON i.section_id = s.id
    GROUP BY s.id, s.budget_id, s.qty, s.section_price
  ),
  section_totals AS (
    SELECT
      budget_id,
      SUM(
        CASE
          WHEN COALESCE(items_sum, 0) > 0 THEN items_sum * section_qty
          WHEN section_price IS NOT NULL THEN section_price * section_qty
          ELSE 0
        END
      ) AS sections_total
    FROM item_totals
    GROUP BY budget_id
  ),
  adjustment_totals AS (
    SELECT budget_id, COALESCE(SUM(sign * amount), 0) AS adj_total
    FROM public.adjustments
    GROUP BY budget_id
  )
  SELECT
    b.id,
    COALESCE(st.sections_total, 0) + COALESCE(at.adj_total, 0) AS total
  FROM public.budgets b
  LEFT JOIN section_totals st ON st.budget_id = b.id
  LEFT JOIN adjustment_totals at ON at.budget_id = b.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_totals() TO authenticated, anon;
