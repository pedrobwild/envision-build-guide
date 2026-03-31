
-- 1. Catalog categories
CREATE TABLE public.catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog categories"
  ON public.catalog_categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage catalog categories"
  ON public.catalog_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage catalog categories"
  ON public.catalog_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));

-- 2. Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  contact_info text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));

-- 3. Catalog items
CREATE TYPE public.catalog_item_type AS ENUM ('product', 'service');

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text,
  item_type public.catalog_item_type NOT NULL DEFAULT 'product',
  category_id uuid REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  unit_of_measure text,
  internal_code text,
  is_active boolean NOT NULL DEFAULT true,
  default_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  search_text text GENERATED ALWAYS AS (
    lower(coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(internal_code, ''))
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_catalog_items_search ON public.catalog_items USING gin (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(description, '')));
CREATE INDEX idx_catalog_items_category ON public.catalog_items (category_id);
CREATE INDEX idx_catalog_items_type ON public.catalog_items (item_type);
CREATE INDEX idx_catalog_items_active ON public.catalog_items (is_active);

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog items"
  ON public.catalog_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage catalog items"
  ON public.catalog_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage catalog items"
  ON public.catalog_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));

-- 4. Catalog item allowed sections (links catalog items to budget section titles)
CREATE TABLE public.catalog_item_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  section_title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (catalog_item_id, section_title)
);

ALTER TABLE public.catalog_item_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog item sections"
  ON public.catalog_item_sections FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage catalog item sections"
  ON public.catalog_item_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage catalog item sections"
  ON public.catalog_item_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));

-- 5. Supplier prices per catalog item (prepared for future use)
CREATE TABLE public.catalog_item_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  unit_price numeric,
  is_preferred boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (catalog_item_id, supplier_id)
);

ALTER TABLE public.catalog_item_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog item suppliers"
  ON public.catalog_item_suppliers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage catalog item suppliers"
  ON public.catalog_item_suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Orcamentistas can manage catalog item suppliers"
  ON public.catalog_item_suppliers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'orcamentista'))
  WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));
