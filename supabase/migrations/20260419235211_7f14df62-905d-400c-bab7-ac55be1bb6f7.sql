-- Permitir 'lead' e 'mql' como internal_status válidos para budgets
-- (necessário pelo trigger create_mql_budget_for_new_client que cria budgets fantasma para novos clientes)

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_internal_status_valid;

ALTER TABLE public.budgets ADD CONSTRAINT budgets_internal_status_valid CHECK (
  internal_status = ANY (ARRAY[
    'novo'::text,
    'mql'::text,
    'lead'::text,
    'requested'::text,
    'triage'::text,
    'assigned'::text,
    'qualificacao'::text,
    'validacao_briefing'::text,
    'em_analise'::text,
    'in_progress'::text,
    'waiting_info'::text,
    'aguardando_info'::text,
    'ready_for_review'::text,
    'em_revisao'::text,
    'revision_requested'::text,
    'delivered_to_sales'::text,
    'sent_to_client'::text,
    'published'::text,
    'minuta_solicitada'::text,
    'contrato_fechado'::text,
    'lost'::text,
    'perdido'::text,
    'archived'::text
  ])
);