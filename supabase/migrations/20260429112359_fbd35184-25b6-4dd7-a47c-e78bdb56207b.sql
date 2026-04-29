-- 1) sync_pipeline_stage_on_change: só altera NEW se valor mudou
CREATE OR REPLACE FUNCTION public.sync_pipeline_stage_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_stage text;
  _new_prob  integer;
BEGIN
  _new_stage := public.derive_pipeline_stage(NEW.internal_status);
  _new_prob  := public.default_win_probability(_new_stage);

  IF TG_OP = 'INSERT' THEN
    -- Só seta se o stage atual diverge do derivado (idempotente)
    IF NEW.pipeline_stage IS DISTINCT FROM _new_stage THEN
      NEW.pipeline_stage := _new_stage;
    END IF;
    IF NEW.win_probability IS NULL THEN
      NEW.win_probability := _new_prob;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN
      -- Só escreve se realmente vai mudar
      IF NEW.pipeline_stage IS DISTINCT FROM _new_stage THEN
        NEW.pipeline_stage := _new_stage;
      END IF;
      -- Probabilidade: só atualiza se usuário não a alterou neste mesmo update
      IF (NEW.win_probability IS NULL OR NEW.win_probability = OLD.win_probability)
         AND NEW.win_probability IS DISTINCT FROM _new_prob THEN
        NEW.win_probability := _new_prob;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) sync_internal_status_from_stage: já tinha guard "se já está no alvo, não faz nada"
--    Reforçamos: se nada vai mudar de fato, retorna sem tocar em NEW.
CREATE OR REPLACE FUNCTION public.sync_internal_status_from_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _target_status text;
  _stage_changed boolean;
  _status_changed boolean;
BEGIN
  _stage_changed  := NEW.pipeline_stage  IS DISTINCT FROM OLD.pipeline_stage;
  _status_changed := NEW.internal_status IS DISTINCT FROM OLD.internal_status;

  -- Anti-loop: se internal_status também mudou nesta UPDATE, não sobrescreve
  IF NOT _stage_changed OR _status_changed THEN
    RETURN NEW;
  END IF;

  _target_status := public.derive_internal_status_from_stage(NEW.pipeline_stage);

  IF _target_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotência: se já está no alvo, não faz nada
  IF NEW.internal_status = _target_status THEN
    RETURN NEW;
  END IF;

  -- Bloqueio: avanço para 'proposta' exige produção pronta
  IF NEW.pipeline_stage = 'proposta'
     AND NOT public.is_production_ready_for_proposal(NEW.internal_status) THEN
    RAISE EXCEPTION
      'Não é possível mover para "Proposta": o orçamento ainda está em produção (status atual: %). Finalize a revisão antes de enviar ao cliente.',
      NEW.internal_status
      USING ERRCODE = 'check_violation',
            HINT = 'Peça ao orçamentista para marcar como "Pronto para revisão" ou "Entregue ao comercial".';
  END IF;

  NEW.internal_status := _target_status;
  RETURN NEW;
END;
$function$;

-- 3) ensure_single_active_budget_per_client: adiciona guard de idempotência
--    e evita re-arquivar quando NEW já está consolidado (reentrada)
CREATE OR REPLACE FUNCTION public.ensure_single_active_budget_per_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _advanced text[] := ARRAY['briefing','visita','proposta','negociacao','fechado'];
  _terminal text[] := ARRAY['contrato_fechado','perdido','lost','archived'];
  _archived integer := 0;
BEGIN
  -- Idempotência: só age quando o stage REALMENTE avançou neste UPDATE
  IF NEW.pipeline_stage IS NULL
     OR NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage
     OR NOT (NEW.pipeline_stage = ANY(_advanced))
     OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guarda extra: se não existe NENHUM outro candidato a arquivar, sai sem escrever
  IF NOT EXISTS (
    SELECT 1 FROM public.budgets b
     WHERE b.client_id = NEW.client_id
       AND b.id <> NEW.id
       AND COALESCE(b.is_current_version, true) = true
       AND NOT (b.internal_status = ANY(_terminal))
       AND (NEW.property_id IS NULL
            OR b.property_id IS NULL
            OR b.property_id = NEW.property_id)
  ) THEN
    RETURN NEW;
  END IF;

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
$function$;

-- 4) log_internal_status_change já tem guard (IS DISTINCT FROM) — sem mudança.