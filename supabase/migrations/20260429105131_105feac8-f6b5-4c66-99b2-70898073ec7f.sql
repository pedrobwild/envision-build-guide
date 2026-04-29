-- ============================================================
-- Sincronização bidirecional: pipeline_stage → internal_status
-- (o caminho inverso já existe em sync_pipeline_stage_from_status)
-- ============================================================

-- Mapa estágio comercial → internal_status alvo (espelho exato)
CREATE OR REPLACE FUNCTION public.derive_internal_status_from_stage(_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _stage
    WHEN 'lead'       THEN 'novo'
    WHEN 'briefing'   THEN 'triage'
    WHEN 'visita'     THEN 'in_progress'
    WHEN 'proposta'   THEN 'sent_to_client'
    WHEN 'negociacao' THEN 'minuta_solicitada'
    WHEN 'fechado'    THEN 'contrato_fechado'
    WHEN 'perdido'    THEN 'lost'
    ELSE NULL
  END;
$$;

-- Status considerados "produção pronta para virar proposta"
-- (qualquer outro bloqueia o avanço para 'proposta')
CREATE OR REPLACE FUNCTION public.is_production_ready_for_proposal(_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _status = ANY (ARRAY[
    'ready_for_review',
    'em_revisao',
    'revision_requested',
    'delivered_to_sales',
    'sent_to_client',
    'published',
    'minuta_solicitada',
    'contrato_fechado'
  ]);
$$;

-- Trigger function: BEFORE UPDATE em budgets
-- Quando pipeline_stage muda (ação do vendedor), sincroniza internal_status
CREATE OR REPLACE FUNCTION public.sync_internal_status_from_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_status text;
  _stage_changed boolean;
  _status_changed boolean;
BEGIN
  _stage_changed  := NEW.pipeline_stage  IS DISTINCT FROM OLD.pipeline_stage;
  _status_changed := NEW.internal_status IS DISTINCT FROM OLD.internal_status;

  -- Anti-loop: se internal_status também mudou nesta UPDATE,
  -- assume-se que o gatilho original foi a produção (sync_pipeline_stage_from_status)
  -- e não devemos sobrescrever de volta.
  IF NOT _stage_changed OR _status_changed THEN
    RETURN NEW;
  END IF;

  _target_status := public.derive_internal_status_from_stage(NEW.pipeline_stage);

  -- Estágio desconhecido → não age
  IF _target_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- BLOQUEIO: avanço para 'proposta' exige produção pronta
  IF NEW.pipeline_stage = 'proposta'
     AND NOT public.is_production_ready_for_proposal(OLD.internal_status) THEN
    RAISE EXCEPTION
      'Não é possível mover para "Proposta": o orçamento ainda está em produção (status atual: %). Finalize a revisão antes de enviar ao cliente.',
      OLD.internal_status
      USING ERRCODE = 'check_violation',
            HINT = 'Peça ao orçamentista para marcar como "Pronto para revisão" ou "Entregue ao comercial".';
  END IF;

  -- Se já está no status alvo, não faz nada
  IF OLD.internal_status = _target_status THEN
    RETURN NEW;
  END IF;

  NEW.internal_status := _target_status;

  -- Reset de owner ao perder: orçamento sai da fila do orçamentista
  -- (mantém estimator_owner_id para histórico, mas internal_status='lost'
  --  já faz o dashboard do orçamentista esconder via estimator-visibility-policy)

  RETURN NEW;
END;
$$;

-- Auditoria AFTER UPDATE: registra a sincronização ocorrida
CREATE OR REPLACE FUNCTION public.log_commercial_stage_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só loga quando ambos mudaram simultaneamente E o estágio mudou
  -- (indicando que a UI alterou o estágio e o trigger BEFORE acompanhou o status)
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage
     AND NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN
    INSERT INTO public.budget_events (
      budget_id, event_type, from_status, to_status, user_id, note, metadata, created_at
    ) VALUES (
      NEW.id,
      'commercial_stage_sync',
      OLD.internal_status,
      NEW.internal_status,
      auth.uid(),
      'Status interno sincronizado automaticamente após mudança no pipeline comercial',
      jsonb_build_object(
        'from_stage', OLD.pipeline_stage,
        'to_stage',   NEW.pipeline_stage,
        'direction',  'commercial_to_production'
      ),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS trg_sync_internal_status_from_stage ON public.budgets;
CREATE TRIGGER trg_sync_internal_status_from_stage
  BEFORE UPDATE OF pipeline_stage ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_internal_status_from_stage();

DROP TRIGGER IF EXISTS trg_log_commercial_stage_sync ON public.budgets;
CREATE TRIGGER trg_log_commercial_stage_sync
  AFTER UPDATE OF pipeline_stage ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_commercial_stage_sync();

-- Bloquear execução pública das funções (defesa em profundidade)
REVOKE EXECUTE ON FUNCTION public.sync_internal_status_from_stage() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_commercial_stage_sync()       FROM anon, authenticated, PUBLIC;