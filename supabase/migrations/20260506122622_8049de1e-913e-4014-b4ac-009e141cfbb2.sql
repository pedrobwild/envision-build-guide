
-- Auditoria de herança de contexto entre orçamentos irmãos
CREATE TABLE IF NOT EXISTS public.budget_inheritance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  source_budget_id uuid,
  inherited_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'trigger',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_budget_inheritance_audit_budget ON public.budget_inheritance_audit (budget_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_inheritance_audit_source ON public.budget_inheritance_audit (source_budget_id);

ALTER TABLE public.budget_inheritance_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage inheritance audit" ON public.budget_inheritance_audit;
CREATE POLICY "Admins manage inheritance audit"
ON public.budget_inheritance_audit
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read inheritance audit of accessible budgets" ON public.budget_inheritance_audit;
CREATE POLICY "Users read inheritance audit of accessible budgets"
ON public.budget_inheritance_audit
FOR SELECT TO authenticated
USING (can_access_budget(auth.uid(), budget_id));

DROP POLICY IF EXISTS "Users insert inheritance audit on accessible budgets" ON public.budget_inheritance_audit;
CREATE POLICY "Users insert inheritance audit on accessible budgets"
ON public.budget_inheritance_audit
FOR INSERT TO authenticated
WITH CHECK (can_access_budget(auth.uid(), budget_id));

DROP POLICY IF EXISTS "Service role manages inheritance audit" ON public.budget_inheritance_audit;
CREATE POLICY "Service role manages inheritance audit"
ON public.budget_inheritance_audit
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Atualiza trigger para registrar herança
CREATE OR REPLACE FUNCTION public.inherit_budget_context_from_sibling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    inherited := inherited || 'floor_plan_url';
    values_map := values_map || jsonb_build_object('floor_plan_url', sibling.floor_plan_url);
  END IF;
  IF NEW.hubspot_deal_url IS NULL AND sibling.hubspot_deal_url IS NOT NULL THEN
    NEW.hubspot_deal_url := sibling.hubspot_deal_url;
    inherited := inherited || 'hubspot_deal_url';
    values_map := values_map || jsonb_build_object('hubspot_deal_url', sibling.hubspot_deal_url);
  END IF;
  IF NULLIF(NEW.briefing,'') IS NULL AND NULLIF(sibling.briefing,'') IS NOT NULL THEN
    NEW.briefing := sibling.briefing;
    inherited := inherited || 'briefing';
    values_map := values_map || jsonb_build_object('briefing', sibling.briefing);
  END IF;
  IF NULLIF(NEW.demand_context,'') IS NULL AND NULLIF(sibling.demand_context,'') IS NOT NULL THEN
    NEW.demand_context := sibling.demand_context;
    inherited := inherited || 'demand_context';
    values_map := values_map || jsonb_build_object('demand_context', sibling.demand_context);
  END IF;
  IF NULLIF(NEW.internal_notes,'') IS NULL AND NULLIF(sibling.internal_notes,'') IS NOT NULL THEN
    NEW.internal_notes := sibling.internal_notes;
    inherited := inherited || 'internal_notes';
    values_map := values_map || jsonb_build_object('internal_notes', sibling.internal_notes);
  END IF;
  IF NULLIF(NEW.client_phone,'') IS NULL AND NULLIF(sibling.client_phone,'') IS NOT NULL THEN
    NEW.client_phone := sibling.client_phone;
    inherited := inherited || 'client_phone';
    values_map := values_map || jsonb_build_object('client_phone', sibling.client_phone);
  END IF;
  IF COALESCE(jsonb_array_length(NEW.reference_links), 0) = 0
     AND COALESCE(jsonb_array_length(sibling.reference_links), 0) > 0 THEN
    NEW.reference_links := sibling.reference_links;
    inherited := inherited || 'reference_links';
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
$$;
