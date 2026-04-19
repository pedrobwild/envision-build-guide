-- 1) Tabela de imóveis por cliente
CREATE TABLE public.client_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT,
  empreendimento TEXT,
  address TEXT,
  address_complement TEXT,
  bairro TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  metragem TEXT,
  property_type TEXT,
  location_type TEXT,
  floor_plan_url TEXT,
  notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_properties_client_id ON public.client_properties(client_id);

ALTER TABLE public.client_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client properties"
  ON public.client_properties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client properties"
  ON public.client_properties FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Admin/comercial/owner can update client properties"
  ON public.client_properties FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_properties.client_id AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_properties.client_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Only admin can delete client properties"
  ON public.client_properties FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_client_properties_updated_at
  BEFORE UPDATE ON public.client_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Adicionar property_id em budgets
ALTER TABLE public.budgets
  ADD COLUMN property_id UUID REFERENCES public.client_properties(id) ON DELETE SET NULL;

CREATE INDEX idx_budgets_property_id ON public.budgets(property_id);

-- 3) Backfill: para cada cliente com dados de imóvel, cria 1 property
INSERT INTO public.client_properties (
  client_id, empreendimento, address, address_complement, bairro, city, state, zip_code,
  metragem, property_type, location_type, floor_plan_url, is_primary, created_by, created_at
)
SELECT
  c.id,
  COALESCE(NULLIF(c.property_empreendimento, ''), NULLIF(c.condominio_default, '')),
  NULLIF(c.property_address, ''),
  NULLIF(c.property_address_complement, ''),
  COALESCE(NULLIF(c.property_bairro, ''), NULLIF(c.bairro, '')),
  COALESCE(NULLIF(c.property_city, ''), NULLIF(c.city, '')),
  COALESCE(NULLIF(c.property_state, ''), NULLIF(c.state, '')),
  COALESCE(NULLIF(c.property_zip_code, ''), NULLIF(c.zip_code, '')),
  NULLIF(c.property_metragem, ''),
  NULLIF(c.property_type_default, ''),
  NULLIF(c.location_type_default, ''),
  NULLIF(c.property_floor_plan_url, ''),
  true,
  c.created_by,
  c.created_at
FROM public.clients c
WHERE
  COALESCE(NULLIF(c.property_empreendimento, ''), NULLIF(c.condominio_default, ''),
           NULLIF(c.property_address, ''), NULLIF(c.property_bairro, ''),
           NULLIF(c.property_metragem, ''), NULLIF(c.property_floor_plan_url, '')) IS NOT NULL;

-- 4) Vincular budgets existentes ao imóvel primário do cliente (1 por cliente, então OK)
UPDATE public.budgets b
SET property_id = cp.id
FROM public.client_properties cp
WHERE b.client_id = cp.client_id
  AND cp.is_primary = true
  AND b.property_id IS NULL;