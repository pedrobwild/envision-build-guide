-- ============================================================
-- Meta + Digisac activation prep
-- ============================================================
-- 1) Adiciona budgets.form_name (nome humano do formulário Meta)
-- 2) Cria UNIQUE parcial em clients.phone_normalized
-- 3) Refatora trigger create_mql_budget_for_new_client em função
--    reutilizável create_mql_budget_for_client(p_client_id uuid)
--    para que digisac-webhook reuse a mesma lógica.
-- 4) Atribui pipeline_id (default) e form_name no budget gerado.
-- ============================================================

-- ---------- 1. Coluna form_name em budgets ----------
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS form_name text;

COMMENT ON COLUMN public.budgets.form_name IS
  'Nome humano do formulário de origem (ex.: Meta Lead Ads form_name). Propagado de clients.form_name na criação.';

-- ---------- 2. UNIQUE parcial em phone_normalized ----------
-- Pré-requisito: cleanup do duplicado já rodou em migration anterior.
CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_normalized_active_uidx
  ON public.clients (phone_normalized)
  WHERE is_active = true AND phone_normalized IS NOT NULL;

-- ---------- 3. Função reusável ----------
CREATE OR REPLACE FUNCTION public.create_mql_budget_for_client(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c              public.clients%ROWTYPE;
  v_internal     text;
  v_pipeline_id  uuid;
  v_budget_id    uuid;
BEGIN
  SELECT * INTO c FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'create_mql_budget_for_client: cliente % nao encontrado', p_client_id;
  END IF;

  -- Idempotência: se já existe budget para o cliente, devolve o mais recente.
  SELECT id INTO v_budget_id
    FROM public.budgets
   WHERE client_id = p_client_id
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_budget_id IS NOT NULL THEN
    RETURN v_budget_id;
  END IF;

  v_internal := CASE WHEN c.status = 'mql' THEN 'mql' ELSE 'lead' END;

  SELECT id INTO v_pipeline_id
    FROM public.deal_pipelines
   WHERE is_default = true
   ORDER BY created_at ASC
   LIMIT 1;

  INSERT INTO public.budgets (
    client_id, client_name, client_phone, lead_email, project_name,
    internal_status, status, priority,
    created_by, commercial_owner_id,
    bairro, city, condominio, metragem, property_type, location_type,
    floor_plan_url,
    external_source, external_lead_id,
    form_id, form_name,
    campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    pipeline_id
  )
  VALUES (
    c.id, c.name, c.phone, c.email,
    COALESCE(NULLIF(c.name, ''), 'Novo lead')
      || COALESCE(' · ' || NULLIF(c.property_empreendimento, ''), '')
      || COALESCE(' · ' || NULLIF(c.property_metragem, ''), ''),
    v_internal, 'draft', 'normal',
    c.created_by, c.commercial_owner_id,
    COALESCE(c.property_bairro, c.bairro),
    COALESCE(c.property_city, c.city),
    c.property_empreendimento, c.property_metragem,
    c.property_type_default, c.location_type_default,
    c.property_floor_plan_url,
    c.external_source, c.external_lead_id,
    c.form_id, c.form_name,
    c.campaign_id, c.campaign_name, c.adset_id, c.adset_name, c.ad_id, c.ad_name,
    c.utm_source, c.utm_medium, c.utm_campaign, c.utm_content, c.utm_term,
    v_pipeline_id
  )
  RETURNING id INTO v_budget_id;

  RETURN v_budget_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_mql_budget_for_client(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mql_budget_for_client(uuid) TO service_role;

COMMENT ON FUNCTION public.create_mql_budget_for_client(uuid) IS
  'Cria budget MQL/lead inicial para um cliente. Reusada por trigger AFTER INSERT em clients e por edge functions (digisac-webhook). Idempotente: devolve budget existente se já houver.';

-- ---------- 4. Trigger fino que delega na função ----------
CREATE OR REPLACE FUNCTION public.create_mql_budget_for_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.create_mql_budget_for_client(NEW.id);
  RETURN NEW;
END;
$function$;
