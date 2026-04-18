-- Add 4 new pre-request stages to internal_status
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_internal_status_check;

ALTER TABLE public.budgets ADD CONSTRAINT budgets_internal_status_check
  CHECK (internal_status = ANY (ARRAY[
    'mql'::text,
    'qualificacao'::text,
    'lead'::text,
    'validacao_briefing'::text,
    'novo'::text,
    'requested'::text,
    'triage'::text,
    'assigned'::text,
    'in_progress'::text,
    'waiting_info'::text,
    'ready_for_review'::text,
    'revision_requested'::text,
    'delivered_to_sales'::text,
    'sent_to_client'::text,
    'minuta_solicitada'::text,
    'contrato_fechado'::text,
    'lost'::text,
    'archived'::text
  ]));