-- 1) Novos campos de cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS rg text,
  -- Endereço residencial
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  -- Endereço do imóvel (separado do residencial)
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS property_address_complement text,
  ADD COLUMN IF NOT EXISTS property_bairro text,
  ADD COLUMN IF NOT EXISTS property_city text,
  ADD COLUMN IF NOT EXISTS property_state text,
  ADD COLUMN IF NOT EXISTS property_zip_code text,
  -- Imóvel
  ADD COLUMN IF NOT EXISTS property_metragem text,
  ADD COLUMN IF NOT EXISTS property_empreendimento text,
  ADD COLUMN IF NOT EXISTS property_floor_plan_url text;

-- 2) Bucket público para anexos do cliente (planta do imóvel etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Policies do bucket client-assets
DROP POLICY IF EXISTS "Public can read client-assets" ON storage.objects;
CREATE POLICY "Public can read client-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-assets');

DROP POLICY IF EXISTS "Authenticated can upload client-assets" ON storage.objects;
CREATE POLICY "Authenticated can upload client-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-assets');

DROP POLICY IF EXISTS "Authenticated can update client-assets" ON storage.objects;
CREATE POLICY "Authenticated can update client-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'client-assets')
  WITH CHECK (bucket_id = 'client-assets');

DROP POLICY IF EXISTS "Authenticated can delete client-assets" ON storage.objects;
CREATE POLICY "Authenticated can delete client-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'client-assets');