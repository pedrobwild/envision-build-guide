
-- Add catalog_item_id to items table to track origin (null = manual/custom item)
ALTER TABLE public.items 
  ADD COLUMN catalog_item_id uuid DEFAULT NULL;

-- Add snapshot metadata for catalog-sourced items
ALTER TABLE public.items
  ADD COLUMN catalog_snapshot jsonb DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.items.catalog_item_id IS 'Reference to catalog_items.id when item was sourced from catalog. NULL means manual/custom item.';
COMMENT ON COLUMN public.items.catalog_snapshot IS 'Snapshot of catalog data at insertion time (supplier, price, etc). Preserves history.';
