-- Índices para acelerar RPCs de KPIs de vendas
-- Foco: sales_kpis_time_in_stage, sales_kpis_cohorts, sales_kpis_by_owner

-- 1) budget_events: filtros por created_at em status_change (sem budget_id)
--    Útil quando RPC filtra por período sem fixar um budget.
CREATE INDEX IF NOT EXISTS idx_budget_events_status_change_created
  ON public.budget_events (created_at)
  WHERE event_type = 'status_change';

-- 2) budget_events: cobre to_status para o LEAD() em time_in_stage
--    e para os FILTERs de terminal_in (won/lost/sent).
CREATE INDEX IF NOT EXISTS idx_budget_events_status_change_to_status
  ON public.budget_events (to_status, created_at)
  WHERE event_type = 'status_change' AND to_status IS NOT NULL;

-- 3) budgets: cohorts/by_owner agrupam por (owner, created_at) quando lead_at cai no fallback
CREATE INDEX IF NOT EXISTS idx_budgets_owner_created
  ON public.budgets (commercial_owner_id, created_at);

-- 4) budgets: scan ordenado por created_at (cohorts sem owner)
CREATE INDEX IF NOT EXISTS idx_budgets_created_at
  ON public.budgets (created_at);

-- 5) budgets: cobre joins na view v_sales_budgets_enriched (property_id já indexado;
--    reforça internal_status que é usado por is_won/is_lost helpers)
CREATE INDEX IF NOT EXISTS idx_budgets_internal_status_owner
  ON public.budgets (internal_status, commercial_owner_id);

-- 6) budget_lost_reasons: agrupamento por reason_category
CREATE INDEX IF NOT EXISTS idx_budget_lost_reasons_reason
  ON public.budget_lost_reasons (reason_category);

-- 7) Atualiza estatísticas para o planner usar os novos índices
ANALYZE public.budget_events;
ANALYZE public.budgets;
ANALYZE public.budget_lost_reasons;
ANALYZE public.client_properties;