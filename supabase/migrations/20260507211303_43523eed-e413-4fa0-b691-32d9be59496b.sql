-- Frente 1: RLS storage.objects DELETE com paridade de role
DROP POLICY IF EXISTS "Authenticated users can delete media" ON storage.objects;

CREATE POLICY "Staff can delete media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      auth.uid() = owner
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'comercial'::app_role)
      OR has_role(auth.uid(), 'orcamentista'::app_role)
    )
  );

-- Frente 2: estende media_change_log
ALTER TABLE public.media_change_log
  DROP CONSTRAINT IF EXISTS media_change_log_change_type_check;

ALTER TABLE public.media_change_log
  ADD CONSTRAINT media_change_log_change_type_check
  CHECK (change_type IN (
    'upload','delete','reorder','replace','sync',
    'manual_correction','clear','storage_delete'
  ));

ALTER TABLE public.media_change_log
  ADD COLUMN IF NOT EXISTS deleted_paths text[];