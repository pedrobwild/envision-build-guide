CREATE OR REPLACE FUNCTION public.inherit_budget_context_from_sibling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sibling RECORD;
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

  SELECT b.floor_plan_url, b.hubspot_deal_url, b.briefing, b.demand_context,
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

  IF NEW.floor_plan_url   IS NULL THEN NEW.floor_plan_url   := sibling.floor_plan_url; END IF;
  IF NEW.hubspot_deal_url IS NULL THEN NEW.hubspot_deal_url := sibling.hubspot_deal_url; END IF;
  IF NULLIF(NEW.briefing,'')        IS NULL THEN NEW.briefing        := sibling.briefing; END IF;
  IF NULLIF(NEW.demand_context,'')  IS NULL THEN NEW.demand_context  := sibling.demand_context; END IF;
  IF NULLIF(NEW.internal_notes,'')  IS NULL THEN NEW.internal_notes  := sibling.internal_notes; END IF;
  IF NULLIF(NEW.client_phone,'')    IS NULL THEN NEW.client_phone    := sibling.client_phone; END IF;
  IF COALESCE(jsonb_array_length(NEW.reference_links), 0) = 0
     AND COALESCE(jsonb_array_length(sibling.reference_links), 0) > 0 THEN
    NEW.reference_links := sibling.reference_links;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_budget_context_from_sibling ON public.budgets;
CREATE TRIGGER trg_inherit_budget_context_from_sibling
BEFORE INSERT ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.inherit_budget_context_from_sibling();

-- Backfill: apenas orçamentos NÃO publicados (guard bloqueia publicados).
WITH targets AS (
  SELECT b.id AS budget_id, b.client_id, b.property_id,
         b.floor_plan_url, b.hubspot_deal_url, b.briefing, b.demand_context,
         b.internal_notes, b.reference_links, b.client_phone
  FROM public.budgets b
  WHERE b.deleted_at IS NULL
    AND COALESCE(b.is_published_version, false) = false
    AND b.client_id IS NOT NULL
    AND b.created_at > now() - interval '60 days'
    AND (
      b.floor_plan_url IS NULL
      OR b.hubspot_deal_url IS NULL
      OR NULLIF(b.briefing,'') IS NULL
      OR NULLIF(b.demand_context,'') IS NULL
      OR NULLIF(b.internal_notes,'') IS NULL
      OR NULLIF(b.client_phone,'') IS NULL
      OR COALESCE(jsonb_array_length(b.reference_links), 0) = 0
    )
),
ranked AS (
  SELECT t.budget_id,
         s.floor_plan_url   AS s_floor,
         s.hubspot_deal_url AS s_hub,
         s.briefing         AS s_brief,
         s.demand_context   AS s_demand,
         s.internal_notes   AS s_notes,
         s.reference_links  AS s_links,
         s.client_phone     AS s_phone,
         ROW_NUMBER() OVER (
           PARTITION BY t.budget_id
           ORDER BY (s.property_id IS NOT DISTINCT FROM t.property_id) DESC,
                    s.created_at DESC
         ) AS rn
  FROM targets t
  JOIN public.budgets s
    ON s.client_id = t.client_id
   AND s.id <> t.budget_id
   AND s.deleted_at IS NULL
   AND (
     s.floor_plan_url IS NOT NULL
     OR s.hubspot_deal_url IS NOT NULL
     OR NULLIF(s.briefing,'') IS NOT NULL
     OR NULLIF(s.demand_context,'') IS NOT NULL
     OR NULLIF(s.internal_notes,'') IS NOT NULL
     OR NULLIF(s.client_phone,'') IS NOT NULL
     OR COALESCE(jsonb_array_length(s.reference_links), 0) > 0
   )
)
UPDATE public.budgets b
SET floor_plan_url   = COALESCE(b.floor_plan_url,   r.s_floor),
    hubspot_deal_url = COALESCE(b.hubspot_deal_url, r.s_hub),
    briefing         = COALESCE(NULLIF(b.briefing,''),       r.s_brief),
    demand_context   = COALESCE(NULLIF(b.demand_context,''), r.s_demand),
    internal_notes   = COALESCE(NULLIF(b.internal_notes,''), r.s_notes),
    client_phone     = COALESCE(NULLIF(b.client_phone,''),   r.s_phone),
    reference_links  = CASE
      WHEN COALESCE(jsonb_array_length(b.reference_links), 0) = 0
           AND COALESCE(jsonb_array_length(r.s_links), 0) > 0
      THEN r.s_links
      ELSE b.reference_links
    END
FROM ranked r
WHERE r.rn = 1 AND r.budget_id = b.id;
