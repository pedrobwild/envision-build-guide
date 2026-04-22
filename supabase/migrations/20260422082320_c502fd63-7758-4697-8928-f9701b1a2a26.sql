-- Trigger: dispara edge function notify-status-change ao entrar em status críticos
CREATE OR REPLACE FUNCTION public.trigger_notify_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Apenas em mudança real de status
  IF NEW.internal_status IS NOT DISTINCT FROM OLD.internal_status THEN
    RETURN NEW;
  END IF;

  -- Só notifica nos status configurados
  IF NEW.internal_status NOT IN ('requested', 'delivered_to_sales') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RAISE WARNING 'notify-status-change: vault secrets ausentes';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/notify-status-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'budget_id', NEW.id,
      'new_status', NEW.internal_status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_notify_status_change ON public.budgets;
CREATE TRIGGER budgets_notify_status_change
AFTER UPDATE OF internal_status ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_status_change();

-- Também dispara em INSERT quando já cria como 'requested'
CREATE OR REPLACE FUNCTION public.trigger_notify_status_change_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  IF NEW.internal_status NOT IN ('requested', 'delivered_to_sales') THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF _supabase_url IS NULL OR _service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/notify-status-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'budget_id', NEW.id,
      'new_status', NEW.internal_status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_notify_status_change_insert ON public.budgets;
CREATE TRIGGER budgets_notify_status_change_insert
AFTER INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_status_change_insert();