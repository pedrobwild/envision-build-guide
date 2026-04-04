
-- Valid transition map for internal_status
CREATE OR REPLACE FUNCTION public.validate_internal_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when internal_status actually changes
  IF OLD.internal_status IS NOT DISTINCT FROM NEW.internal_status THEN
    RETURN NEW;
  END IF;

  -- Define allowed transitions
  IF NOT (
    (OLD.internal_status = 'novo'              AND NEW.internal_status IN ('requested', 'triage', 'assigned'))
    OR (OLD.internal_status = 'requested'      AND NEW.internal_status IN ('triage', 'assigned'))
    OR (OLD.internal_status = 'triage'         AND NEW.internal_status IN ('assigned'))
    OR (OLD.internal_status = 'assigned'       AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'in_progress'    AND NEW.internal_status IN ('ready_for_review', 'blocked', 'waiting_info'))
    OR (OLD.internal_status = 'ready_for_review' AND NEW.internal_status IN ('delivered_to_sales', 'in_progress'))
    OR (OLD.internal_status = 'delivered_to_sales' AND NEW.internal_status IN ('sent_to_client', 'revision_requested'))
    OR (OLD.internal_status = 'sent_to_client' AND NEW.internal_status IN ('revision_requested', 'minuta_solicitada', 'lost'))
    OR (OLD.internal_status = 'revision_requested' AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'blocked'        AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'waiting_info'   AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'minuta_solicitada' AND NEW.internal_status IN ('contrato_fechado', 'revision_requested'))
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.internal_status, NEW.internal_status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_status_transition
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_internal_status_transition();
