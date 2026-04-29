-- =====================================================================
-- SINCRONIZAÇÃO 1:1 LEAD ↔ ORÇAMENTO SEM DUPLICAÇÃO
-- Regras:
--   • Seleção: por property_id (com fallback para mais recente ativo)
--   • Reativação: lost → triage; contrato_fechado → cria aditivo
--   • Múltiplos ativos: auto-seleção silenciosa (prefere com pipeline_id)
-- =====================================================================

-- 1) Resolver qual orçamento responde pelo lead {client_id, property_id}
CREATE OR REPLACE FUNCTION public.resolve_active_budget_for_lead(
  _client_id  uuid,
  _property_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _terminal text[] := ARRAY['contrato_fechado','perdido','lost','archived'];
  _budget_id uuid;
BEGIN
  IF _client_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- (a) preferência: orçamento ativo do MESMO imóvel
  IF _property_id IS NOT NULL THEN
    SELECT b.id INTO _budget_id
      FROM public.budgets b
     WHERE b.client_id = _client_id
       AND b.property_id = _property_id
       AND NOT (b.internal_status = ANY(_terminal))
       AND COALESCE(b.is_current_version, true) = true
     ORDER BY (b.pipeline_id IS NOT NULL) DESC, b.updated_at DESC
     LIMIT 1;
    IF _budget_id IS NOT NULL THEN
      RETURN _budget_id;
    END IF;
  END IF;

  -- (b) fallback: mais recente ativo do cliente (preferindo já vinculado)
  SELECT b.id INTO _budget_id
    FROM public.budgets b
   WHERE b.client_id = _client_id
     AND NOT (b.internal_status = ANY(_terminal))
     AND COALESCE(b.is_current_version, true) = true
     AND (_property_id IS NULL OR b.property_id IS NULL OR b.property_id = _property_id)
   ORDER BY (b.pipeline_id IS NOT NULL) DESC, b.updated_at DESC
   LIMIT 1;

  RETURN _budget_id;
END;
$$;

-- 2) Reabrir lost / criar aditivo de fechado para um cliente reativado
CREATE OR REPLACE FUNCTION public.reactivate_or_addendum_budget(
  _client_id   uuid,
  _property_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lost_id   uuid;
  _closed_id uuid;
  _new_id    uuid;
  _next_addn integer;
BEGIN
  IF _client_id IS NULL THEN RETURN NULL; END IF;

  -- 2a) Lost mais recente do imóvel (ou cliente) → reabre como triage
  SELECT id INTO _lost_id
    FROM public.budgets
   WHERE client_id = _client_id
     AND internal_status IN ('lost','perdido')
     AND (_property_id IS NULL OR property_id IS NULL OR property_id = _property_id)
     AND COALESCE(is_current_version, true) = true
   ORDER BY updated_at DESC LIMIT 1;

  IF _lost_id IS NOT NULL THEN
    UPDATE public.budgets
       SET internal_status = 'triage',
           pipeline_stage  = 'briefing',
           updated_at      = now()
     WHERE id = _lost_id;

    INSERT INTO public.budget_events(budget_id, event_type, note, metadata, created_at)
    VALUES (_lost_id, 'budget_reactivated',
            'Orçamento perdido reaberto automaticamente para nova oportunidade',
            jsonb_build_object('reason','client_reactivated','property_id', _property_id), now());
    RETURN _lost_id;
  END IF;

  -- 2b) Sem lost: procura contrato_fechado para gerar aditivo
  SELECT id INTO _closed_id
    FROM public.budgets
   WHERE client_id = _client_id
     AND internal_status = 'contrato_fechado'
     AND (_property_id IS NULL OR property_id IS NULL OR property_id = _property_id)
     AND COALESCE(is_current_version, true) = true
   ORDER BY closed_at DESC NULLS LAST, updated_at DESC LIMIT 1;

  IF _closed_id IS NOT NULL THEN
    SELECT COALESCE(MAX(addendum_number), 0) + 1
      INTO _next_addn
      FROM public.budgets
     WHERE addendum_base_budget_id = _closed_id;

    INSERT INTO public.budgets (
      client_id, property_id, project_name, client_name, internal_status,
      pipeline_stage, is_addendum, addendum_base_budget_id, addendum_number,
      commercial_owner_id, estimator_owner_id
    )
    SELECT b.client_id, COALESCE(_property_id, b.property_id),
           COALESCE(b.project_name,'') || ' — Aditivo ' || _next_addn,
           b.client_name, 'triage', 'briefing',
           true, b.id, _next_addn,
           b.commercial_owner_id, b.estimator_owner_id
      FROM public.budgets b WHERE b.id = _closed_id
    RETURNING id INTO _new_id;

    INSERT INTO public.budget_events(budget_id, event_type, note, metadata, created_at)
    VALUES (_new_id, 'addendum_created',
            'Aditivo criado a partir do contrato fechado',
            jsonb_build_object('base_budget_id', _closed_id, 'addendum_number', _next_addn), now());
    RETURN _new_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 3) Refina consolidação: arquiva duplicados em QUALQUER stage avançado,
--    preferindo manter o que tem pipeline_id. Antes só agia quando duplicado='lead'.
CREATE OR REPLACE FUNCTION public.ensure_single_active_budget_per_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _advanced text[] := ARRAY['briefing','visita','proposta','negociacao','fechado'];
  _terminal text[] := ARRAY['contrato_fechado','perdido','lost','archived'];
  _archived integer := 0;
BEGIN
  IF NEW.pipeline_stage IS NULL
     OR NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage
     OR NOT (NEW.pipeline_stage = ANY(_advanced))
     OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Arquiva todos os outros orçamentos ativos do cliente para o mesmo imóvel
  -- (ou todos se property_id do NEW for NULL). NEW é mantido como o canônico.
  WITH archived AS (
    UPDATE public.budgets b
       SET internal_status = 'archived',
           updated_at = now()
     WHERE b.client_id = NEW.client_id
       AND b.id <> NEW.id
       AND COALESCE(b.is_current_version, true) = true
       AND NOT (b.internal_status = ANY(_terminal))
       AND (NEW.property_id IS NULL
            OR b.property_id IS NULL
            OR b.property_id = NEW.property_id)
    RETURNING b.id
  )
  SELECT count(*) INTO _archived FROM archived;

  IF _archived > 0 THEN
    INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
    VALUES (NEW.id, 'pipeline_consolidation',
            'Orçamentos duplicados do mesmo cliente/imóvel foram arquivados',
            jsonb_build_object('archived_count', _archived,
                               'property_id', NEW.property_id,
                               'reason','single_active_per_client_property'),
            now());
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Índice para acelerar resolução por (client_id, property_id) ativos
CREATE INDEX IF NOT EXISTS idx_budgets_active_client_property
  ON public.budgets (client_id, property_id, updated_at DESC)
  WHERE internal_status NOT IN ('contrato_fechado','perdido','lost','archived')
    AND COALESCE(is_current_version, true) = true;

GRANT EXECUTE ON FUNCTION public.resolve_active_budget_for_lead(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_or_addendum_budget(uuid, uuid) TO authenticated;