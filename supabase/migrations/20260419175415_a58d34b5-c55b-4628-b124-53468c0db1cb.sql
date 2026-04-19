CREATE OR REPLACE FUNCTION public.create_mql_budget_for_new_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_internal_status text;
BEGIN
  -- Skip se já existe budget para o cliente
  IF EXISTS (SELECT 1 FROM public.budgets WHERE client_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Deriva internal_status a partir do status do cliente.
  -- 'mql'  -> 'mql' (entra na coluna MQL)
  -- demais -> 'lead' (Pipeline Comercial - etapa Lead)
  v_internal_status := CASE
    WHEN NEW.status = 'mql' THEN 'mql'
    ELSE 'lead'
  END;

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
    city,
    condominio,
    metragem,
    property_type,
    location_type,
    floor_plan_url,
    external_source,
    external_lead_id,
    form_id,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.phone,
    NEW.email,
    COALESCE(NULLIF(NEW.name, ''), 'Novo lead')
      || COALESCE(' · ' || NULLIF(NEW.property_empreendimento, ''), '')
      || COALESCE(' · ' || NULLIF(NEW.property_metragem, ''), ''),
    v_internal_status,
    'draft',
    'normal',
    NEW.created_by,
    NEW.commercial_owner_id,
    COALESCE(NEW.property_bairro, NEW.bairro),
    COALESCE(NEW.property_city, NEW.city),
    NEW.property_empreendimento,
    NEW.property_metragem,
    NEW.property_type_default,
    NEW.location_type_default,
    NEW.property_floor_plan_url,
    NEW.external_source,
    NEW.external_lead_id,
    NEW.form_id,
    NEW.campaign_id,
    NEW.campaign_name,
    NEW.adset_id,
    NEW.adset_name,
    NEW.ad_id,
    NEW.ad_name,
    NEW.utm_source,
    NEW.utm_medium,
    NEW.utm_campaign,
    NEW.utm_content,
    NEW.utm_term
  );

  RETURN NEW;
END;
$function$;