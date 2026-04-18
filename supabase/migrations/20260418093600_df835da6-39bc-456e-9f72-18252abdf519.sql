-- Drop old check constraint and recreate with the two allowed values
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;

-- Normalize any out-of-spec values first, then backfill 'cliente'
UPDATE public.clients SET status = 'lead' WHERE status NOT IN ('lead', 'cliente');

UPDATE public.clients c
SET status = 'cliente'
WHERE EXISTS (
  SELECT 1 FROM public.budgets b
  WHERE b.client_id = c.id AND b.internal_status = 'contrato_fechado'
);

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check CHECK (status IN ('lead', 'cliente'));

-- Trigger to keep client.status in sync with budget.internal_status
CREATE OR REPLACE FUNCTION public.sync_client_status_from_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _client_id := OLD.client_id;
  ELSE
    _client_id := NEW.client_id;
  END IF;

  IF _client_id IS NOT NULL THEN
    UPDATE public.clients
    SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.budgets b
        WHERE b.client_id = _client_id AND b.internal_status = 'contrato_fechado'
      ) THEN 'cliente' ELSE 'lead'
    END
    WHERE id = _client_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.client_id IS NOT NULL
     AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    UPDATE public.clients
    SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.budgets b
        WHERE b.client_id = OLD.client_id AND b.internal_status = 'contrato_fechado'
      ) THEN 'cliente' ELSE 'lead'
    END
    WHERE id = OLD.client_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_status_from_budget ON public.budgets;
CREATE TRIGGER trg_sync_client_status_from_budget
AFTER INSERT OR UPDATE OF internal_status, client_id OR DELETE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_status_from_budget();