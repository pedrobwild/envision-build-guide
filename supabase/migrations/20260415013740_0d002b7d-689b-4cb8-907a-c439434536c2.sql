
-- Trigger function: notify estimator on new budget request
CREATE OR REPLACE FUNCTION public.on_budget_requested_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire for new requests with an assigned estimator
  IF NEW.internal_status = 'requested' AND NEW.estimator_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, budget_id, read)
    VALUES (
      NEW.estimator_owner_id,
      'new_budget_request',
      'Nova solicitação de orçamento',
      COALESCE(NEW.sequential_code, '') || ' · ' || COALESCE(NEW.client_name, '') || ' · ' || COALESCE(NEW.project_name, ''),
      NEW.id,
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_budget_requested_notify
AFTER INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.on_budget_requested_notify();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
