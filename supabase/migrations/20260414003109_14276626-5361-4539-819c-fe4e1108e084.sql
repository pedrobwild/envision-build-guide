ALTER TABLE public.budgets
ADD CONSTRAINT budgets_internal_status_valid
CHECK (internal_status IN (
  'novo', 'requested', 'triage', 'assigned',
  'in_progress', 'waiting_info', 'blocked',
  'ready_for_review', 'revision_requested',
  'delivered_to_sales', 'sent_to_client',
  'minuta_solicitada', 'contrato_fechado',
  'lost', 'archived'
));