-- =========================================================================
-- FIX A: client_stats view → SECURITY INVOKER (respeita RLS do usuário)
-- =========================================================================
ALTER VIEW public.client_stats SET (security_invoker = true);

-- =========================================================================
-- FIX B: storage.objects — bloquear LIST anônimo nos buckets públicos
-- Mantém acesso por URL pública (getPublicUrl não consulta RLS)
-- =========================================================================

-- media
DROP POLICY IF EXISTS "Anyone can view media files" ON storage.objects;
CREATE POLICY "Authenticated can list media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'media');

-- budget-assets
DROP POLICY IF EXISTS "Anyone can view budget assets" ON storage.objects;
CREATE POLICY "Authenticated can list budget assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'budget-assets');

-- budget-pdfs
DROP POLICY IF EXISTS "Anyone can read budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated can list budget PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'budget-pdfs');