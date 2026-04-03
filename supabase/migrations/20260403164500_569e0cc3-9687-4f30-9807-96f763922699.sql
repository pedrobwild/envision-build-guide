
-- Budget Templates
CREATE TABLE public.budget_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.budget_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read templates"
  ON public.budget_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON public.budget_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Budget Template Sections
CREATE TABLE public.budget_template_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.budget_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  tags JSONB DEFAULT '[]',
  included_bullets JSONB DEFAULT '[]',
  excluded_bullets JSONB DEFAULT '[]',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.budget_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template sections"
  ON public.budget_template_sections FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage template sections"
  ON public.budget_template_sections FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Budget Template Items
CREATE TABLE public.budget_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_section_id UUID NOT NULL REFERENCES public.budget_template_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  unit TEXT,
  qty NUMERIC,
  order_index INTEGER NOT NULL DEFAULT 0,
  coverage_type TEXT NOT NULL DEFAULT 'geral',
  reference_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.budget_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read template items"
  ON public.budget_template_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage template items"
  ON public.budget_template_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
