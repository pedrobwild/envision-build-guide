CREATE OR REPLACE FUNCTION public.trigger_sync_project_on_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    PERFORM net.http_post(
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
$function$;

-- Also fix the supplier sync trigger
CREATE OR REPLACE FUNCTION public.trigger_sync_supplier_outbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- LOOP PREVENTION: skip if this supplier was synced from portal_bwild
  IF NEW.external_system = 'portal_bwild' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF _supabase_url IS NULL OR _anon_key IS NULL THEN
    RAISE WARNING 'Missing vault secrets for supplier sync';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/sync-supplier-outbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object('supplier_id', NEW.id)
  );

  RETURN NEW;
END;
$function$;