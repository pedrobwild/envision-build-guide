
ALTER TABLE public.catalog_items DROP COLUMN search_text;

ALTER TABLE public.catalog_items
ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(internal_code, '') || ' ' ||
    coalesce(unit_of_measure, '')
  )
) STORED;
