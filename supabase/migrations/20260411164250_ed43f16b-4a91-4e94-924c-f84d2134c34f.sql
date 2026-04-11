
CREATE OR REPLACE FUNCTION public.set_primary_supplier_price(
  p_catalog_item_id UUID,
  p_price_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE catalog_item_supplier_prices
    SET is_primary = (id = p_price_id)
  WHERE catalog_item_id = p_catalog_item_id;
END;
$$;
