-- ============================================================
-- Catalog improvements migration
-- 1) catalog_alerts_config (singleton)
-- 2) catalog_price_history + trigger
-- 3) catalog_categories.sort_order + reorder RPC
-- ============================================================

-- 1) Alerts configuration (singleton) ------------------------
CREATE TABLE IF NOT EXISTS public.catalog_alerts_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean UNIQUE DEFAULT true CHECK (singleton),
  stale_price_days int NOT NULL DEFAULT 90,
  high_lead_time_days int NOT NULL DEFAULT 30,
  max_price_increase_pct numeric NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.catalog_alerts_config (singleton)
VALUES (true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.catalog_alerts_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog_alerts_config"
  ON public.catalog_alerts_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage catalog_alerts_config"
  ON public.catalog_alerts_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Orcamentistas can update catalog_alerts_config"
  ON public.catalog_alerts_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'::app_role));

-- 2) Price history --------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalog_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  old_unit_price numeric,
  new_unit_price numeric,
  old_lead_time_days int,
  new_lead_time_days int,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);

CREATE INDEX IF NOT EXISTS catalog_price_history_item_supplier_idx
  ON public.catalog_price_history (catalog_item_id, supplier_id, changed_at DESC);

ALTER TABLE public.catalog_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog_price_history"
  ON public.catalog_price_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage catalog_price_history"
  ON public.catalog_price_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger function: log price/lead-time changes
CREATE OR REPLACE FUNCTION public.log_supplier_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price
     OR NEW.lead_time_days IS DISTINCT FROM OLD.lead_time_days THEN
    INSERT INTO public.catalog_price_history (
      catalog_item_id, supplier_id,
      old_unit_price, new_unit_price,
      old_lead_time_days, new_lead_time_days,
      changed_by
    ) VALUES (
      NEW.catalog_item_id, NEW.supplier_id,
      OLD.unit_price, NEW.unit_price,
      OLD.lead_time_days, NEW.lead_time_days,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_supplier_price_change ON public.catalog_item_supplier_prices;
CREATE TRIGGER trg_log_supplier_price_change
  AFTER UPDATE ON public.catalog_item_supplier_prices
  FOR EACH ROW EXECUTE FUNCTION public.log_supplier_price_change();

-- 3) Catalog categories sort order ----------------------------
ALTER TABLE public.catalog_categories
  ADD COLUMN IF NOT EXISTS sort_order int;

-- Backfill: rank existing rows by name within each category_type
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY category_type ORDER BY name) AS rn
  FROM public.catalog_categories
  WHERE sort_order IS NULL
)
UPDATE public.catalog_categories c
SET sort_order = r.rn
FROM ranked r
WHERE c.id = r.id;

ALTER TABLE public.catalog_categories
  ALTER COLUMN sort_order SET DEFAULT 0;

ALTER TABLE public.catalog_categories
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS catalog_categories_sort_order_idx
  ON public.catalog_categories (category_type, sort_order);

-- RPC for batch reorder
CREATE OR REPLACE FUNCTION public.reorder_catalog_categories(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'orcamentista'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE public.catalog_categories
       SET sort_order = i
     WHERE id = p_ids[i];
  END LOOP;
END;
$$;
