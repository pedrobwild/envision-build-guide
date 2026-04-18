CREATE OR REPLACE FUNCTION public.create_mql_budget_for_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if a budget already exists for this client (e.g. created via NewBudgetRequest)
  IF EXISTS (SELECT 1 FROM public.budgets WHERE client_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.budgets (
    client_id,
    client_name,
    client_phone,
    lead_email,
    project_name,
    internal_status,
    status,
    priority,
    created_by,
    commercial_owner_id,
    bairro,
    city
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.phone,
    NEW.email,
    COALESCE(NULLIF(NEW.name, ''), 'Novo lead') || ' - MQL',
    'mql',
    'draft',
    'normal',
    NEW.created_by,
    NEW.commercial_owner_id,
    NEW.bairro,
    NEW.city
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_mql_budget_for_new_client ON public.clients;

CREATE TRIGGER trg_create_mql_budget_for_new_client
AFTER INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.create_mql_budget_for_new_client();