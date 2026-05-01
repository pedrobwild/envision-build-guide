
-- 1) Trigger AFTER INSERT em budgets: registra budget_created
CREATE OR REPLACE FUNCTION public.log_budget_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text;
BEGIN
  -- Detecta a origem com base nos campos preenchidos no INSERT
  v_source := CASE
    WHEN NEW.parent_budget_id IS NOT NULL THEN 'cloned'
    WHEN NEW.is_addendum = true THEN 'addendum'
    WHEN NEW.external_lead_id IS NOT NULL OR NEW.external_source IS NOT NULL THEN coalesce(NEW.external_source, 'external_lead')
    WHEN NEW.budget_pdf_url IS NOT NULL THEN 'imported_pdf'
    WHEN NEW.version_group_id IS NOT NULL AND NEW.version_group_id <> NEW.id THEN 'new_version'
    ELSE 'manual'
  END;

  INSERT INTO budget_events (budget_id, event_type, note, metadata, user_id, to_status)
  VALUES (
    NEW.id,
    'budget_created',
    format('Orçamento criado (origem: %s)', v_source),
    jsonb_build_object(
      'source', v_source,
      'parent_budget_id', NEW.parent_budget_id,
      'is_addendum', NEW.is_addendum,
      'external_source', NEW.external_source,
      'external_lead_id', NEW.external_lead_id,
      'utm_source', NEW.utm_source,
      'utm_campaign', NEW.utm_campaign,
      'lead_source', NEW.lead_source,
      'client_id', NEW.client_id,
      'property_id', NEW.property_id,
      'version_group_id', NEW.version_group_id,
      'version_number', NEW.version_number
    ),
    NEW.created_by,
    NEW.internal_status
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_budget_created ON public.budgets;
CREATE TRIGGER trg_log_budget_created
AFTER INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.log_budget_created();

-- 2) Trigger AFTER UPDATE em budgets: registra envio (status -> published) e fechamento (internal_status -> closed_won)
CREATE OR REPLACE FUNCTION public.log_budget_lifecycle_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Envio ao cliente: status muda para 'published' (e antes não era)
  IF NEW.status = 'published'
     AND coalesce(OLD.status,'') <> 'published'
     AND NEW.public_id IS NOT NULL THEN
    INSERT INTO budget_events (budget_id, event_type, note, metadata, user_id, from_status, to_status)
    VALUES (
      NEW.id,
      'budget_sent_to_client',
      'Orçamento enviado ao cliente',
      jsonb_build_object(
        'public_id', NEW.public_id,
        'manual_total', NEW.manual_total,
        'client_id', NEW.client_id,
        'property_id', NEW.property_id
      ),
      auth.uid(),
      OLD.status,
      NEW.status
    );
  END IF;

  -- Fechamento como ganho
  IF NEW.internal_status = 'closed_won'
     AND coalesce(OLD.internal_status,'') <> 'closed_won' THEN
    INSERT INTO budget_events (budget_id, event_type, note, metadata, user_id, from_status, to_status)
    VALUES (
      NEW.id,
      'budget_closed_won',
      'Contrato fechado',
      jsonb_build_object(
        'closed_at', coalesce(NEW.closed_at, now()),
        'manual_total', NEW.manual_total,
        'client_id', NEW.client_id,
        'property_id', NEW.property_id,
        'pipeline_stage', NEW.pipeline_stage
      ),
      auth.uid(),
      OLD.internal_status,
      NEW.internal_status
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_budget_lifecycle ON public.budgets;
CREATE TRIGGER trg_log_budget_lifecycle
AFTER UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.log_budget_lifecycle_transitions();

-- 3) Backfill: cria budget_created retroativo para todos os budgets sem esse evento
INSERT INTO budget_events (budget_id, event_type, note, metadata, user_id, to_status, created_at)
SELECT
  b.id,
  'budget_created',
  format('Orçamento criado (retroativo, origem: %s)',
    CASE
      WHEN b.parent_budget_id IS NOT NULL THEN 'cloned'
      WHEN b.is_addendum = true THEN 'addendum'
      WHEN b.external_lead_id IS NOT NULL OR b.external_source IS NOT NULL THEN coalesce(b.external_source, 'external_lead')
      WHEN b.budget_pdf_url IS NOT NULL THEN 'imported_pdf'
      WHEN b.version_group_id IS NOT NULL AND b.version_group_id <> b.id THEN 'new_version'
      ELSE 'manual'
    END
  ),
  jsonb_build_object(
    'backfilled', true,
    'source', CASE
      WHEN b.parent_budget_id IS NOT NULL THEN 'cloned'
      WHEN b.is_addendum = true THEN 'addendum'
      WHEN b.external_lead_id IS NOT NULL OR b.external_source IS NOT NULL THEN coalesce(b.external_source, 'external_lead')
      WHEN b.budget_pdf_url IS NOT NULL THEN 'imported_pdf'
      WHEN b.version_group_id IS NOT NULL AND b.version_group_id <> b.id THEN 'new_version'
      ELSE 'manual'
    END,
    'parent_budget_id', b.parent_budget_id,
    'is_addendum', b.is_addendum,
    'external_source', b.external_source,
    'lead_source', b.lead_source,
    'client_id', b.client_id,
    'property_id', b.property_id,
    'version_group_id', b.version_group_id,
    'version_number', b.version_number
  ),
  b.created_by,
  b.internal_status,
  b.created_at
FROM budgets b
WHERE NOT EXISTS (
  SELECT 1 FROM budget_events e
  WHERE e.budget_id = b.id AND e.event_type = 'budget_created'
);

-- Índice para acelerar consultas de timeline por budget+tipo
CREATE INDEX IF NOT EXISTS idx_budget_events_budget_type_created
  ON public.budget_events (budget_id, event_type, created_at DESC);
