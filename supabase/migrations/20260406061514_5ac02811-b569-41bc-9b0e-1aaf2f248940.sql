
ALTER TABLE public.catalog_categories
ADD COLUMN category_type text NOT NULL DEFAULT 'Produtos';

-- Backfill from existing description
UPDATE public.catalog_categories
SET category_type = description
WHERE description IN ('Prestadores', 'Produtos');
