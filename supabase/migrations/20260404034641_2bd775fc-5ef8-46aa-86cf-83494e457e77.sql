
-- Fix storage policies: add ownership checks to DELETE and UPDATE

-- budget-assets: restrict DELETE to file owner or admin
DROP POLICY IF EXISTS "Authenticated users can delete their budget assets" ON storage.objects;
CREATE POLICY "Authenticated users can delete their budget assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'budget-assets'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.budgets
      WHERE created_by = auth.uid()
         OR estimator_owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- budget-assets: restrict UPDATE to file owner or admin
DROP POLICY IF EXISTS "Authenticated users can update their budget assets" ON storage.objects;
CREATE POLICY "Authenticated users can update their budget assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'budget-assets'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.budgets
      WHERE created_by = auth.uid()
         OR estimator_owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- media: restrict DELETE to file owner or admin
DROP POLICY IF EXISTS "Authenticated users can delete media" ON storage.objects;
CREATE POLICY "Authenticated users can delete media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'media'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- media: restrict UPDATE to file owner or admin
DROP POLICY IF EXISTS "Authenticated users can update media" ON storage.objects;
CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'media'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
