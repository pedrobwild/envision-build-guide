
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function: auto-sync supplier on insert/update
CREATE OR REPLACE FUNCTION public.trigger_sync_supplier_outbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF _supabase_url IS NULL OR _anon_key IS NULL THEN
    RAISE WARNING 'Missing vault secrets for supplier sync';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/sync-supplier-outbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object('supplier_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Trigger: fire on supplier insert or update
CREATE TRIGGER trg_sync_supplier_outbound
  AFTER INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_supplier_outbound();

-- Function: auto-create project on contrato_fechado
CREATE OR REPLACE FUNCTION public.trigger_sync_project_on_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only fire when transitioning TO contrato_fechado
  IF NEW.internal_status = 'contrato_fechado'
     AND (OLD.internal_status IS DISTINCT FROM 'contrato_fechado') THEN

    SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _anon_key IS NULL THEN
      RAISE WARNING 'Missing vault secrets for project sync';
      RETURN NEW;
    END IF;

    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/sync-project-outbound',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('budget_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: fire on budget status change
CREATE TRIGGER trg_sync_project_on_contrato
  AFTER UPDATE ON public.budgets
  FOR EACH ROW
  WHEN (OLD.internal_status IS DISTINCT FROM NEW.internal_status)
  EXECUTE FUNCTION public.trigger_sync_project_on_contrato();
