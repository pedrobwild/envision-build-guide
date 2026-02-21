
-- Budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'approved', 'expired', 'archived')),
  project_name TEXT NOT NULL DEFAULT '',
  unit TEXT,
  client_name TEXT NOT NULL DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  validity_days INTEGER DEFAULT 30,
  notes TEXT,
  disclaimer TEXT DEFAULT 'Os valores apresentados são válidos pelo prazo indicado. Alterações de escopo podem impactar o orçamento final.',
  generated_at TIMESTAMPTZ DEFAULT now(),
  public_id TEXT UNIQUE,
  public_token_hash TEXT,
  show_item_qty BOOLEAN DEFAULT true,
  show_item_prices BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their budgets"
ON public.budgets FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Public can view published budgets by public_id"
ON public.budgets FOR SELECT TO anon
USING (status = 'published' AND public_id IS NOT NULL);

-- Sections table
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  qty NUMERIC,
  section_price NUMERIC,
  cover_image_url TEXT,
  tags JSONB DEFAULT '[]',
  included_bullets JSONB DEFAULT '[]',
  excluded_bullets JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage sections via budget ownership"
ON public.sections FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND created_by = auth.uid()));

CREATE POLICY "Public can view sections of published budgets"
ON public.sections FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND status = 'published' AND public_id IS NOT NULL));

-- Items table
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  qty NUMERIC,
  unit TEXT,
  internal_unit_price NUMERIC,
  internal_total NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage items via budget ownership"
ON public.items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = section_id AND b.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = section_id AND b.created_by = auth.uid()
));

CREATE POLICY "Public can view items of published budgets"
ON public.items FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE s.id = section_id AND b.status = 'published' AND b.public_id IS NOT NULL
));

-- Item images
CREATE TABLE public.item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage item_images via budget ownership"
ON public.item_images FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_id AND b.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_id AND b.created_by = auth.uid()
));

CREATE POLICY "Public can view item_images of published budgets"
ON public.item_images FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.items i
  JOIN public.sections s ON s.id = i.section_id
  JOIN public.budgets b ON b.id = s.budget_id
  WHERE i.id = item_id AND b.status = 'published' AND b.public_id IS NOT NULL
));

-- Adjustments (taxes, discounts)
CREATE TABLE public.adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  sign INTEGER NOT NULL DEFAULT 1 CHECK (sign IN (1, -1)),
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage adjustments via budget ownership"
ON public.adjustments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND created_by = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND created_by = auth.uid()));

CREATE POLICY "Public can view adjustments of published budgets"
ON public.adjustments FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.budgets WHERE id = budget_id AND status = 'published' AND public_id IS NOT NULL));

-- Media library
CREATE TABLE public.media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder TEXT DEFAULT 'geral',
  tags JSONB DEFAULT '[]',
  url TEXT NOT NULL,
  filename TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage media"
ON public.media_library FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Storage bucket for budget assets
INSERT INTO storage.buckets (id, name, public) VALUES ('budget-assets', 'budget-assets', true);

CREATE POLICY "Anyone can view budget assets"
ON storage.objects FOR SELECT USING (bucket_id = 'budget-assets');

CREATE POLICY "Authenticated users can upload budget assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'budget-assets');

CREATE POLICY "Authenticated users can update their budget assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'budget-assets');

CREATE POLICY "Authenticated users can delete their budget assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'budget-assets');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
