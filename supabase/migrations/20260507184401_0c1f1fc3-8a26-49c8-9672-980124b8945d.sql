DO $$
BEGIN
  ALTER TABLE public.budgets DISABLE TRIGGER guard_published_budget_update_trg;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.budgets DISABLE TRIGGER USER;

UPDATE public.budgets
SET media_config = jsonb_build_object(
  'projeto3d', jsonb_build_array(
    'https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/18c70ffe3171/3d/01-MARCOS-03-15-.png',
    'https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/18c70ffe3171/3d/02-MARCOS-03-5-.png',
    'https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/18c70ffe3171/3d/03-MARCOS-03-6-.png',
    'https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/18c70ffe3171/3d/04-MARCIELLE-E-RAFAEL-2-14-.png'
  ),
  'projetoExecutivo', '[]'::jsonb,
  'fotos', '[]'::jsonb,
  'primary', '{}'::jsonb
)
WHERE id = '5df5f4f8-1e31-4cad-81f8-3d33bb83ed36';

ALTER TABLE public.budgets ENABLE TRIGGER USER;