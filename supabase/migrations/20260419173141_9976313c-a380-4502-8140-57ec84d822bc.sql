-- Backfill property fields on clients from their budgets when client fields are empty.
-- For each client, prefer the most recent budget that has any property data.
WITH ranked AS (
  SELECT
    b.client_id,
    b.condominio,
    b.bairro,
    b.city,
    b.metragem,
    b.property_type,
    b.location_type,
    b.floor_plan_url,
    ROW_NUMBER() OVER (
      PARTITION BY b.client_id
      ORDER BY
        (CASE WHEN COALESCE(b.condominio, b.bairro, b.city, b.metragem, b.property_type, b.location_type) IS NOT NULL THEN 0 ELSE 1 END),
        b.updated_at DESC NULLS LAST,
        b.created_at DESC NULLS LAST
    ) AS rn
  FROM public.budgets b
  WHERE b.client_id IS NOT NULL
)
UPDATE public.clients c
SET
  property_empreendimento = COALESCE(NULLIF(c.property_empreendimento, ''), r.condominio),
  property_bairro         = COALESCE(NULLIF(c.property_bairro, ''),         r.bairro),
  property_city           = COALESCE(NULLIF(c.property_city, ''),           r.city),
  property_metragem       = COALESCE(NULLIF(c.property_metragem, ''),       r.metragem),
  property_type_default   = COALESCE(NULLIF(c.property_type_default, ''),   r.property_type),
  location_type_default   = COALESCE(NULLIF(c.location_type_default, ''),   r.location_type),
  property_floor_plan_url = COALESCE(NULLIF(c.property_floor_plan_url, ''), r.floor_plan_url),
  condominio_default      = COALESCE(NULLIF(c.condominio_default, ''),      r.condominio)
FROM ranked r
WHERE r.client_id = c.id
  AND r.rn = 1;

-- Trigger: when a budget is inserted/updated with property fields,
-- backfill the linked client if those fields are empty.
CREATE OR REPLACE FUNCTION public.sync_client_property_from_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.clients c
  SET
    property_empreendimento = COALESCE(NULLIF(c.property_empreendimento, ''), NEW.condominio),
    property_bairro         = COALESCE(NULLIF(c.property_bairro, ''),         NEW.bairro),
    property_city           = COALESCE(NULLIF(c.property_city, ''),           NEW.city),
    property_metragem       = COALESCE(NULLIF(c.property_metragem, ''),       NEW.metragem),
    property_type_default   = COALESCE(NULLIF(c.property_type_default, ''),   NEW.property_type),
    location_type_default   = COALESCE(NULLIF(c.location_type_default, ''),   NEW.location_type),
    property_floor_plan_url = COALESCE(NULLIF(c.property_floor_plan_url, ''), NEW.floor_plan_url),
    condominio_default      = COALESCE(NULLIF(c.condominio_default, ''),      NEW.condominio),
    bairro                  = COALESCE(NULLIF(c.bairro, ''),                  NEW.bairro),
    city                    = COALESCE(NULLIF(c.city, ''),                    NEW.city)
  WHERE c.id = NEW.client_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_property_from_budget ON public.budgets;
CREATE TRIGGER trg_sync_client_property_from_budget
AFTER INSERT OR UPDATE OF condominio, bairro, city, metragem, property_type, location_type, floor_plan_url, client_id
ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_property_from_budget();