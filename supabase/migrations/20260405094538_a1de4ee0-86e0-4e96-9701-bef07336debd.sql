
-- Create sequence for catalog item codes
CREATE SEQUENCE IF NOT EXISTS public.catalog_item_code_seq START WITH 1;

-- Set sequence to start after existing items count
SELECT setval('public.catalog_item_code_seq', COALESCE((SELECT COUNT(*) FROM public.catalog_items), 0) + 1, false);

-- Create trigger function
CREATE OR REPLACE FUNCTION public.generate_catalog_item_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
    NEW.internal_code := 'CAT-' || LPAD(nextval('public.catalog_item_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_catalog_item_code ON public.catalog_items;
CREATE TRIGGER trg_catalog_item_code
  BEFORE INSERT ON public.catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_catalog_item_code();

-- Backfill existing items that have no code
UPDATE public.catalog_items
SET internal_code = 'CAT-' || LPAD(nextval('public.catalog_item_code_seq')::text, 4, '0')
WHERE internal_code IS NULL OR internal_code = '';
