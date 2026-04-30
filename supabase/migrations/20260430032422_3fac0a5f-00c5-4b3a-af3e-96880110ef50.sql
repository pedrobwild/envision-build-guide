-- 1) Permitir múltiplos orçamentos para o mesmo cliente+imóvel
--    Remove o trigger que redirecionava silenciosamente inserts duplicados.
DROP TRIGGER IF EXISTS budgets_redirect_duplicate_insert ON public.budgets;

-- A função fica disponível caso queiramos reativar pontualmente no futuro,
-- mas sem o trigger ela não roda. Comente o DROP abaixo se preferir manter:
DROP FUNCTION IF EXISTS public.redirect_duplicate_budget_insert();

-- 2) Consolidação: só arquiva os outros quando o pipeline avança para 'fechado'.
--    Antes arquivava em briefing/visita/proposta/negociacao/fechado, agora só fechado.
CREATE OR REPLACE FUNCTION public.ensure_single_active_budget_per_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _terminal text[] := ARRAY['contrato_fechado','perdido','lost','archived'];
  _archived integer := 0;
BEGIN
  -- Idempotência: só age quando o stage REALMENTE virou 'fechado' neste UPDATE
  IF NEW.pipeline_stage IS NULL
     OR NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage
     OR NEW.pipeline_stage <> 'fechado'
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
            'Orçamentos paralelos do mesmo cliente/imóvel foram arquivados ao fechar contrato',
            jsonb_build_object('archived_count', _archived,
                               'property_id', NEW.property_id,
                               'reason','single_active_per_client_property_on_close'),
            now());
  END IF;

  RETURN NEW;
END;
$function$;