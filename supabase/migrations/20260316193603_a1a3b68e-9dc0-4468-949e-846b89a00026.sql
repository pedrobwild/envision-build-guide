-- Global photo library indexed by normalized item name
CREATE TABLE public.item_photo_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_name_normalized text NOT NULL,
  url text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(item_name_normalized, created_by)
);

ALTER TABLE public.item_photo_library ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all library entries (global scope)
CREATE POLICY "Authenticated users can read photo library"
  ON public.item_photo_library FOR SELECT
  TO authenticated USING (true);

-- Users can manage their own entries
CREATE POLICY "Users manage their own photo library entries"
  ON public.item_photo_library FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Seed from existing item_images: pick the most recent primary image per unique item title per user
INSERT INTO public.item_photo_library (item_name, item_name_normalized, url, created_by, created_at)
SELECT DISTINCT ON (lower(trim(i.title)), b.created_by)
  i.title,
  lower(trim(i.title)),
  img.url,
  b.created_by,
  img.created_at
FROM item_images img
JOIN items i ON i.id = img.item_id
JOIN sections s ON s.id = i.section_id
JOIN budgets b ON b.id = s.budget_id
WHERE img.is_primary = true
  AND b.created_by IS NOT NULL
  AND trim(i.title) != ''
ORDER BY lower(trim(i.title)), b.created_by, img.created_at DESC
ON CONFLICT (item_name_normalized, created_by) DO NOTHING;