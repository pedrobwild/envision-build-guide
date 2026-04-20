-- Fix: incluir commercial_owner_id nas políticas de upload/update/delete do bucket budget-assets
DROP POLICY IF EXISTS "Authenticated users can upload budget assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their budget assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their budget assets" ON storage.objects;

CREATE POLICY "Authenticated users can upload budget assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'budget-assets'
  AND (
    -- folders especiais que não dependem de budget_id (ex: floor-plans/, catalog/)
    (storage.foldername(name))[1] NOT IN (SELECT id::text FROM budgets) IS NOT FALSE
    OR (((storage.foldername(name))[1])::uuid IN (
      SELECT b.id FROM budgets b
      WHERE b.created_by = auth.uid()
        OR b.estimator_owner_id = auth.uid()
        OR b.commercial_owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'orcamentista'::app_role)
        OR has_role(auth.uid(), 'comercial'::app_role)
    ))
  )
);

CREATE POLICY "Authenticated users can update their budget assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'budget-assets'
  AND (
    (storage.foldername(name))[1] NOT IN (SELECT id::text FROM budgets) IS NOT FALSE
    OR (((storage.foldername(name))[1])::uuid IN (
      SELECT b.id FROM budgets b
      WHERE b.created_by = auth.uid()
        OR b.estimator_owner_id = auth.uid()
        OR b.commercial_owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'orcamentista'::app_role)
        OR has_role(auth.uid(), 'comercial'::app_role)
    ))
  )
);

CREATE POLICY "Authenticated users can delete their budget assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'budget-assets'
  AND (
    (storage.foldername(name))[1] NOT IN (SELECT id::text FROM budgets) IS NOT FALSE
    OR (((storage.foldername(name))[1])::uuid IN (
      SELECT b.id FROM budgets b
      WHERE b.created_by = auth.uid()
        OR b.estimator_owner_id = auth.uid()
        OR b.commercial_owner_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'orcamentista'::app_role)
        OR has_role(auth.uid(), 'comercial'::app_role)
    ))
  )
);