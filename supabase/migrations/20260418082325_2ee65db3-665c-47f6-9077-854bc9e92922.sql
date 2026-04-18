-- Trigger function: log every internal_status change to budget_events
CREATE OR REPLACE FUNCTION public.log_internal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if the status actually changed
  IF NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN
    INSERT INTO public.budget_events (
      budget_id,
      event_type,
      from_status,
      to_status,
      user_id,
      created_at
    )
    VALUES (
      NEW.id,
      'status_change',
      OLD.internal_status,
      NEW.internal_status,
      auth.uid(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then attach
DROP TRIGGER IF EXISTS trg_log_internal_status_change ON public.budgets;

CREATE TRIGGER trg_log_internal_status_change
AFTER UPDATE OF internal_status ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.log_internal_status_change();