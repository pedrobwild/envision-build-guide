-- Fix 1: trigger de herança usa operador ambíguo `text[] || 'literal'` que o
-- Postgres interpreta como `text[] || text[]`, causando "malformed array literal".
-- Trocar por array_append explícito.
CREATE OR REPLACE FUNCTION public.inherit_budget_context_from_sibling()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sibling RECORD;
  source_id uuid;
  inherited text[] := ARRAY[]::text[];
  values_map jsonb := '{}'::jsonb;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.floor_plan_url IS NOT NULL
     AND NEW.hubspot_deal_url IS NOT NULL
     AND NULLIF(NEW.briefing,'') IS NOT NULL
     AND NULLIF(NEW.demand_context,'') IS NOT NULL
     AND NULLIF(NEW.internal_notes,'') IS NOT NULL
     AND NULLIF(NEW.client_phone,'') IS NOT NULL
     AND COALESCE(jsonb_array_length(NEW.reference_links), 0) > 0
  THEN
    RETURN NEW;
  END IF;

  SELECT b.id, b.floor_plan_url, b.hubspot_deal_url, b.briefing, b.demand_context,
         b.internal_notes, b.reference_links, b.client_phone
  INTO sibling
  FROM public.budgets b
  WHERE b.client_id = NEW.client_id
    AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.deleted_at IS NULL
    AND (
      b.floor_plan_url IS NOT NULL
      OR b.hubspot_deal_url IS NOT NULL
      OR NULLIF(b.briefing,'') IS NOT NULL
      OR NULLIF(b.demand_context,'') IS NOT NULL
      OR NULLIF(b.internal_notes,'') IS NOT NULL
      OR NULLIF(b.client_phone,'') IS NOT NULL
      OR COALESCE(jsonb_array_length(b.reference_links), 0) > 0
    )
  ORDER BY (b.property_id IS NOT DISTINCT FROM NEW.property_id) DESC,
           b.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  source_id := sibling.id;

  IF NEW.floor_plan_url IS NULL AND sibling.floor_plan_url IS NOT NULL THEN
    NEW.floor_plan_url := sibling.floor_plan_url;
    inherited := array_append(inherited, 'floor_plan_url'::text);
    values_map := values_map || jsonb_build_object('floor_plan_url', sibling.floor_plan_url);
  END IF;
  IF NEW.hubspot_deal_url IS NULL AND sibling.hubspot_deal_url IS NOT NULL THEN
    NEW.hubspot_deal_url := sibling.hubspot_deal_url;
    inherited := array_append(inherited, 'hubspot_deal_url'::text);
    values_map := values_map || jsonb_build_object('hubspot_deal_url', sibling.hubspot_deal_url);
  END IF;
  IF NULLIF(NEW.briefing,'') IS NULL AND NULLIF(sibling.briefing,'') IS NOT NULL THEN
    NEW.briefing := sibling.briefing;
    inherited := array_append(inherited, 'briefing'::text);
    values_map := values_map || jsonb_build_object('briefing', sibling.briefing);
  END IF;
  IF NULLIF(NEW.demand_context,'') IS NULL AND NULLIF(sibling.demand_context,'') IS NOT NULL THEN
    NEW.demand_context := sibling.demand_context;
    inherited := array_append(inherited, 'demand_context'::text);
    values_map := values_map || jsonb_build_object('demand_context', sibling.demand_context);
  END IF;
  IF NULLIF(NEW.internal_notes,'') IS NULL AND NULLIF(sibling.internal_notes,'') IS NOT NULL THEN
    NEW.internal_notes := sibling.internal_notes;
    inherited := array_append(inherited, 'internal_notes'::text);
    values_map := values_map || jsonb_build_object('internal_notes', sibling.internal_notes);
  END IF;
  IF NULLIF(NEW.client_phone,'') IS NULL AND NULLIF(sibling.client_phone,'') IS NOT NULL THEN
    NEW.client_phone := sibling.client_phone;
    inherited := array_append(inherited, 'client_phone'::text);
    values_map := values_map || jsonb_build_object('client_phone', sibling.client_phone);
  END IF;
  IF COALESCE(jsonb_array_length(NEW.reference_links), 0) = 0
     AND COALESCE(jsonb_array_length(sibling.reference_links), 0) > 0 THEN
    NEW.reference_links := sibling.reference_links;
    inherited := array_append(inherited, 'reference_links'::text);
    values_map := values_map || jsonb_build_object('reference_links', sibling.reference_links);
  END IF;

  IF array_length(inherited, 1) IS NOT NULL THEN
    INSERT INTO public.budget_inheritance_audit
      (budget_id, source_budget_id, inherited_fields, field_values, source, created_by)
    VALUES
      (COALESCE(NEW.id, gen_random_uuid()), source_id, to_jsonb(inherited), values_map, 'trigger', NEW.created_by);
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix 2: o backfill do editor escreve briefing/demand_context/reference_links/hubspot_deal_url
-- mesmo em orçamento publicado, derrubando autosave. Adicionar esses campos ao allowlist
-- do guard (não alteram preço/escopo, apenas contexto interno e links de apoio).
CREATE OR REPLACE FUNCTION public.guard_published_budget_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_cols text[] := ARRAY[]::text[];
  v_safe_cols text[] := ARRAY[
    'view_count','last_viewed_at',
    'deleted_at','deleted_by',
    'updated_at',
    'is_published_version','status','published_at',
    'public_id',
    'date',
    'internal_status','internal_deadline','priority',
    'commercial_owner_id','estimator_owner_id',
    'internal_notes',
    'briefing','demand_context','reference_links','hubspot_deal_url',
    'client_phone','floor_plan_url',
    'property_id','client_id','pipeline_id','pipeline_stage',
    'closed_at','contract_file_url','win_probability',
    'is_current_version'
  ];
BEGIN
  IF COALESCE(OLD.is_published_version, false) = false THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(col)
    INTO v_changed_cols
  FROM (
    SELECT key AS col
      FROM jsonb_each(to_jsonb(NEW)) n
      LEFT JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value
  ) diff;

  IF v_changed_cols IS NULL THEN
    RETURN NEW;
  END IF;

  v_changed_cols := ARRAY(
    SELECT c FROM unnest(v_changed_cols) c
    WHERE c <> ALL(v_safe_cols)
  );

  IF array_length(v_changed_cols, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'published_budget_immutable: tentativa de alterar campo(s) {%} em orçamento publicado (id=%). Crie uma nova versão (fork) antes de editar.',
    array_to_string(v_changed_cols, ','),
    OLD.id
    USING ERRCODE = 'check_violation',
          HINT = 'Use duplicateBudgetAsVersion() para criar uma nova versão editável.';
END;
$function$;