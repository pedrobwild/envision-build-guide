-- 1. Função: arquivar duplicados quando o cliente passa a ter um orçamento avançado
CREATE OR REPLACE FUNCTION public.ensure_single_active_budget_per_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_advanced_stages text[] := ARRAY['briefing','visita','proposta','negociacao','fechado'];
  v_archived_count integer := 0;
BEGIN
  -- Só age quando o stage muda E o novo stage é avançado
  IF NEW.pipeline_stage IS NULL
     OR NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage
     OR NOT (NEW.pipeline_stage = ANY(v_advanced_stages))
     OR NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Arquiva outros orçamentos ativos do mesmo cliente que ainda estão em 'lead'
  -- (mantém o atual como o "ativo principal")
  WITH archived AS (
    UPDATE public.budgets b
       SET internal_status = 'archived',
           updated_at = now()
     WHERE b.client_id = NEW.client_id
       AND b.id <> NEW.id
       AND b.pipeline_stage = 'lead'
       AND b.internal_status NOT IN ('contrato_fechado','perdido','lost','archived')
       AND COALESCE(b.is_current_version, true) = true
    RETURNING b.id
  )
  SELECT count(*) INTO v_archived_count FROM archived;

  -- Loga evento de consolidação
  IF v_archived_count > 0 THEN
    INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
    VALUES (
      NEW.id,
      'pipeline_consolidation',
      'Orçamentos duplicados (lead) deste cliente foram arquivados ao avançar de etapa',
      jsonb_build_object('archived_count', v_archived_count, 'reason', 'auto_consolidate_on_advance'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Função: round-robin de orçamentista ao entrar em briefing
CREATE OR REPLACE FUNCTION public.auto_assign_estimator_on_briefing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estimator_id uuid;
  v_pool uuid[];
  v_pool_size int;
  v_idx int;
BEGIN
  -- Só age na transição PARA briefing/visita/proposta/negociacao quando ainda não tem orçamentista
  IF NEW.pipeline_stage IS NULL
     OR NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage
     OR NEW.pipeline_stage NOT IN ('briefing','visita','proposta','negociacao')
     OR NEW.estimator_owner_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta usar regras de roteamento existentes (resolve_lead_owner) — mas só serve se houver pool
  -- Caso contrário, faz round-robin manual entre todos com role 'orcamentista'
  SELECT array_agg(ur.user_id ORDER BY ur.user_id)
    INTO v_pool
    FROM public.user_roles ur
   WHERE ur.role = 'orcamentista'::app_role;

  v_pool_size := COALESCE(array_length(v_pool, 1), 0);
  IF v_pool_size = 0 THEN
    RETURN NEW;
  END IF;

  -- Round-robin baseado em quem tem menos orçamentos ativos atribuídos
  SELECT u
    INTO v_estimator_id
    FROM unnest(v_pool) AS u
    LEFT JOIN LATERAL (
      SELECT count(*) AS active_count
        FROM public.budgets b
       WHERE b.estimator_owner_id = u
         AND b.internal_status NOT IN ('contrato_fechado','perdido','lost','archived')
    ) sub ON true
    ORDER BY sub.active_count ASC NULLS FIRST, u ASC
    LIMIT 1;

  IF v_estimator_id IS NOT NULL THEN
    NEW.estimator_owner_id := v_estimator_id;

    INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
    VALUES (
      NEW.id,
      'estimator_auto_assigned',
      'Orçamentista atribuído automaticamente ao avançar para ' || NEW.pipeline_stage,
      jsonb_build_object('estimator_id', v_estimator_id, 'stage', NEW.pipeline_stage, 'reason', 'round_robin_least_loaded'),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Triggers (BEFORE para que mudanças em NEW persistam; consolidação é AFTER porque atualiza outras linhas)
DROP TRIGGER IF EXISTS trg_auto_assign_estimator_on_briefing ON public.budgets;
CREATE TRIGGER trg_auto_assign_estimator_on_briefing
BEFORE UPDATE OF internal_status, pipeline_stage ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_estimator_on_briefing();

DROP TRIGGER IF EXISTS trg_ensure_single_active_budget_per_client ON public.budgets;
CREATE TRIGGER trg_ensure_single_active_budget_per_client
AFTER UPDATE OF internal_status, pipeline_stage ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_budget_per_client();