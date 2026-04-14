
-- Fix sections anon policy
DROP POLICY IF EXISTS "Public can view sections of published budgets" ON public.sections;
CREATE POLICY "Public can view sections of published budgets"
ON public.sections
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = sections.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));

-- Fix items anon policy
DROP POLICY IF EXISTS "Public can view items of published budgets" ON public.items;
CREATE POLICY "Public can view items of published budgets"
ON public.items
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM sections s
  JOIN budgets b ON b.id = s.budget_id
  WHERE s.id = items.section_id
    AND b.status IN ('published', 'minuta_solicitada')
    AND b.public_id IS NOT NULL
));

-- Fix adjustments anon policy
DROP POLICY IF EXISTS "Public can view adjustments of published budgets" ON public.adjustments;
CREATE POLICY "Public can view adjustments of published budgets"
ON public.adjustments
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = adjustments.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));

-- Fix item_images anon policy
DROP POLICY IF EXISTS "Public can view item_images of published budgets" ON public.item_images;
CREATE POLICY "Public can view item_images of published budgets"
ON public.item_images
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM items i
  JOIN sections s ON s.id = i.section_id
  JOIN budgets b ON b.id = s.budget_id
  WHERE i.id = item_images.item_id
    AND b.status IN ('published', 'minuta_solicitada')
    AND b.public_id IS NOT NULL
));
