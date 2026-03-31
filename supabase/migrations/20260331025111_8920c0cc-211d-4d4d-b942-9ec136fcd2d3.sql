
-- Drop the old simpler table in favor of the richer one
DROP TABLE IF EXISTS public.catalog_item_suppliers;

-- Create the full supplier pricing table
CREATE TABLE public.catalog_item_supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_sku text,
  unit_price numeric,
  currency text NOT NULL DEFAULT 'BRL',
  minimum_order_qty numeric,
  lead_time_days integer,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (catalog_item_id, supplier_id)
);

CREATE INDEX idx_cisp_item ON public.catalog_item_supplier_prices (catalog_item_id);
CREATE INDEX idx_cisp_supplier ON public.catalog_item_supplier_prices (supplier_id);
CREATE INDEX idx_cisp_primary ON public.catalog_item_supplier_prices (catalog_item_id, is_primary) WHERE is_primary = true;

ALTER TABLE public.catalog_item_supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supplier prices"
  ON public.catalog_item_supplier_prices FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage supplier prices"
  ON public.catalog_item_supplier_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage supplier prices"
  ON public.catalog_item_supplier_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));
