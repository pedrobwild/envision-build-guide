-- Validação bloqueante: impede coexistência de "sent_to_client" e "contrato_fechado"
-- para o mesmo cliente+imóvel no pipeline ativo.
CREATE OR REPLACE FUNCTION public.validate_pipeline_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _conflict record;
  _new_is_sent boolean;
  _new_is_closed boolean;
  _conflict_label text;
  _new_label text;
BEGIN
  -- Só valida quando internal_status REALMENTE mudou neste UPDATE
  IF NEW.internal_status IS NOT DISTINCT FROM OLD.internal_status THEN
    RETURN NEW;
  END IF;

  -- Só valida transições para os dois estados sensíveis
  _new_is_sent := NEW.internal_status IN ('sent_to_client', 'minuta_solicitada', 'revision_requested', 'delivered_to_sales', 'ready_for_review');
  _new_is_closed := NEW.internal_status = 'contrato_fechado';

  IF NOT (_new_is_sent OR _new_is_closed) THEN
    RETURN NEW;
  END IF;

  -- Só valida se há cliente vinculado
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Procura conflito: mesmo cliente+imóvel, outro budget, versão atual, em estado conflitante
  SELECT b.id, b.sequential_code, b.project_name, b.internal_status, b.commercial_owner_id, b.estimator_owner_id
    INTO _conflict
    FROM public.budgets b
   WHERE b.client_id = NEW.client_id
     AND b.id <> NEW.id
     AND b.deleted_at IS NULL
     AND COALESCE(b.is_current_version, true) = true
     AND (
           NEW.property_id IS NULL
           OR b.property_id IS NULL
           OR b.property_id = NEW.property_id
         )
     AND (
           -- Se NEW vai para "fechado", conflita com qualquer "enviado" ou outro "fechado" ativo
           (_new_is_closed AND b.internal_status IN (
              'sent_to_client','minuta_solicitada','revision_requested',
              'delivered_to_sales','ready_for_review','contrato_fechado'
            ))
           OR
           -- Se NEW vai para "enviado", conflita com "fechado" existente
           (_new_is_sent AND b.internal_status = 'contrato_fechado')
         )
   LIMIT 1;

  IF _conflict.id IS NULL THEN
    RETURN NEW;
  END IF;

  _conflict_label := CASE _conflict.internal_status
    WHEN 'contrato_fechado' THEN 'Contrato Fechado'
    WHEN 'sent_to_client' THEN 'Enviado ao Cliente'
    WHEN 'minuta_solicitada' THEN 'Minuta Solicitada'
    WHEN 'revision_requested' THEN 'Revisão Solicitada'
    WHEN 'delivered_to_sales' THEN 'Entregue ao Comercial'
    WHEN 'ready_for_review' THEN 'Pronto para Revisão'
    ELSE _conflict.internal_status
  END;

  _new_label := CASE
    WHEN _new_is_closed THEN 'Contrato Fechado'
    ELSE 'Enviado ao Cliente'
  END;

  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = format(
      'Não é possível mover este orçamento para "%s": já existe outro orçamento do mesmo cliente/imóvel em "%s" (código %s, projeto "%s"). Arquive ou marque como perdido o orçamento conflitante antes de prosseguir.',
      _new_label,
      _conflict_label,
      COALESCE(_conflict.sequential_code, _conflict.id::text),
      COALESCE(_conflict.project_name, 'sem nome')
    ),
    HINT = 'Conflict budget id: ' || _conflict.id::text;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_pipeline_exclusivity ON public.budgets;
CREATE TRIGGER trg_validate_pipeline_exclusivity
BEFORE UPDATE OF internal_status ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.validate_pipeline_exclusivity();