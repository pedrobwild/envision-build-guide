
-- ITEMS: orçamentistas podem gerenciar em orçamentos não atribuídos
DROP POLICY IF EXISTS "Orcamentista can manage items on assigned budgets" ON public.items;
CREATE POLICY "Orcamentista can manage items on accessible budgets"
ON public.items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE s.id = items.section_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sections s
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE s.id = items.section_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
);

-- SECTIONS
DROP POLICY IF EXISTS "Orcamentista can manage sections on assigned budgets" ON public.sections;
CREATE POLICY "Orcamentista can manage sections on accessible budgets"
ON public.sections FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = sections.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = sections.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
);

-- ADJUSTMENTS
DROP POLICY IF EXISTS "Orcamentista can manage adjustments on assigned budgets" ON public.adjustments;
CREATE POLICY "Orcamentista can manage adjustments on accessible budgets"
ON public.adjustments FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = adjustments.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = adjustments.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
);

-- ROOMS
DROP POLICY IF EXISTS "Orcamentista can manage rooms on assigned budgets" ON public.rooms;
CREATE POLICY "Orcamentista can manage rooms on accessible budgets"
ON public.rooms FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = rooms.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = rooms.budget_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
);

-- ITEM IMAGES
DROP POLICY IF EXISTS "Orcamentista can manage item_images on assigned budgets" ON public.item_images;
CREATE POLICY "Orcamentista can manage item_images on accessible budgets"
ON public.item_images FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.sections s ON s.id = i.section_id
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE i.id = item_images.item_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.items i
    JOIN public.sections s ON s.id = i.section_id
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE i.id = item_images.item_id
      AND (b.estimator_owner_id = auth.uid()
           OR (b.estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista')))
  )
);

-- BUDGETS: permitir que orçamentistas atualizem orçamentos não atribuídos (claim)
CREATE POLICY "Orcamentista can update unassigned budgets"
ON public.budgets FOR UPDATE TO authenticated
USING (estimator_owner_id IS NULL AND public.has_role(auth.uid(), 'orcamentista'))
WITH CHECK (public.has_role(auth.uid(), 'orcamentista'));
