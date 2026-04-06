
DELETE FROM public.catalog_categories WHERE id = '5280f3fb-4074-449a-8443-9e5837d3bfd8';
ALTER TABLE public.catalog_categories ADD CONSTRAINT catalog_categories_name_unique UNIQUE (name);
