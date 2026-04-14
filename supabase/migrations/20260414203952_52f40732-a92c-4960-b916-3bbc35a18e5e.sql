
-- Authenticated users can view published budgets (public page while logged in)
CREATE POLICY "Authenticated can view published budgets"
ON public.budgets FOR SELECT TO authenticated
USING (
  status IN ('published', 'minuta_solicitada')
  AND public_id IS NOT NULL
);

-- Sections: authenticated can view published
CREATE POLICY "Authenticated can view sections of published budgets"
ON public.sections FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = sections.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));

-- Items: authenticated can view published
CREATE POLICY "Authenticated can view items of published budgets"
ON public.items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM sections s
  JOIN budgets b ON b.id = s.budget_id
  WHERE s.id = items.section_id
    AND b.status IN ('published', 'minuta_solicitada')
    AND b.public_id IS NOT NULL
));

-- Adjustments: authenticated can view published
CREATE POLICY "Authenticated can view adjustments of published budgets"
ON public.adjustments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = adjustments.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));

-- Item images: authenticated can view published
CREATE POLICY "Authenticated can view item_images of published budgets"
ON public.item_images FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM items i
  JOIN sections s ON s.id = i.section_id
  JOIN budgets b ON b.id = s.budget_id
  WHERE i.id = item_images.item_id
    AND b.status IN ('published', 'minuta_solicitada')
    AND b.public_id IS NOT NULL
));

-- Budget tours: authenticated can view published
CREATE POLICY "Authenticated can view tours of published budgets"
ON public.budget_tours FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = budget_tours.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));

-- Fix rooms: update existing public policy to include minuta_solicitada
DROP POLICY IF EXISTS "Public can view rooms of published budgets" ON public.rooms;
CREATE POLICY "Public can view rooms of published budgets"
ON public.rooms FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM budgets
  WHERE budgets.id = rooms.budget_id
    AND budgets.status IN ('published', 'minuta_solicitada')
    AND budgets.public_id IS NOT NULL
));
