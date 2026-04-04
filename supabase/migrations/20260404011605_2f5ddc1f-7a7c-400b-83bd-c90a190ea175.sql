CREATE OR REPLACE FUNCTION public.validate_internal_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only fire when internal_status actually changes
  IF OLD.internal_status IS NOT DISTINCT FROM NEW.internal_status THEN
    RETURN NEW;
  END IF;

  -- Define allowed transitions (relaxed to match UI workflows)
  IF NOT (
    -- From novo: can go to requested, triage, assigned, or directly to in_progress
    (OLD.internal_status = 'novo'              AND NEW.internal_status IN ('requested', 'triage', 'assigned', 'in_progress'))
    -- From requested: can go to triage, assigned, or directly to in_progress
    OR (OLD.internal_status = 'requested'      AND NEW.internal_status IN ('triage', 'assigned', 'in_progress'))
    -- From triage: can go to assigned or directly to in_progress
    OR (OLD.internal_status = 'triage'         AND NEW.internal_status IN ('assigned', 'in_progress'))
    -- From assigned: can go to in_progress
    OR (OLD.internal_status = 'assigned'       AND NEW.internal_status IN ('in_progress'))
    -- From in_progress: can go to ready_for_review, blocked, waiting_info
    OR (OLD.internal_status = 'in_progress'    AND NEW.internal_status IN ('ready_for_review', 'blocked', 'waiting_info'))
    -- From ready_for_review: can go to delivered_to_sales or back to in_progress
    OR (OLD.internal_status = 'ready_for_review' AND NEW.internal_status IN ('delivered_to_sales', 'in_progress'))
    -- From delivered_to_sales: can go to sent_to_client or revision_requested
    OR (OLD.internal_status = 'delivered_to_sales' AND NEW.internal_status IN ('sent_to_client', 'revision_requested'))
    -- From sent_to_client: can go to revision_requested, minuta_solicitada, or lost
    OR (OLD.internal_status = 'sent_to_client' AND NEW.internal_status IN ('revision_requested', 'minuta_solicitada', 'lost'))
    -- From revision_requested: can go back to in_progress
    OR (OLD.internal_status = 'revision_requested' AND NEW.internal_status IN ('in_progress'))
    -- From blocked/waiting_info: can go back to in_progress
    OR (OLD.internal_status = 'blocked'        AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'waiting_info'   AND NEW.internal_status IN ('in_progress'))
    -- From minuta_solicitada: can go to contrato_fechado or revision_requested
    OR (OLD.internal_status = 'minuta_solicitada' AND NEW.internal_status IN ('contrato_fechado', 'revision_requested'))
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.internal_status, NEW.internal_status;
  END IF;

  RETURN NEW;
END;
$function$;