-- 1) Permitir que Comercial gerencie sections dos orçamentos atribuídos a ele
CREATE POLICY "Comercial can manage sections of assigned budgets"
ON public.sections
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = sections.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = sections.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
);

-- 2) Permitir que Comercial gerencie items
CREATE POLICY "Comercial can manage items of assigned budgets"
ON public.items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sections s
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE s.id = items.section_id
      AND b.commercial_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sections s
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE s.id = items.section_id
      AND b.commercial_owner_id = auth.uid()
  )
);

-- 3) Permitir que Comercial gerencie item_images
CREATE POLICY "Comercial can manage item_images of assigned budgets"
ON public.item_images
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.items i
    JOIN public.sections s ON s.id = i.section_id
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE i.id = item_images.item_id
      AND b.commercial_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.items i
    JOIN public.sections s ON s.id = i.section_id
    JOIN public.budgets b ON b.id = s.budget_id
    WHERE i.id = item_images.item_id
      AND b.commercial_owner_id = auth.uid()
  )
);

-- 4) Permitir que Comercial gerencie adjustments
CREATE POLICY "Comercial can manage adjustments of assigned budgets"
ON public.adjustments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = adjustments.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = adjustments.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
);

-- 5) Permitir que Comercial gerencie rooms
CREATE POLICY "Comercial can manage rooms of assigned budgets"
ON public.rooms
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = rooms.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = rooms.budget_id
      AND b.commercial_owner_id = auth.uid()
  )
);

-- 6) Limpar órfãos: versões com status='published' mas is_published_version=false
-- num grupo onde já existe outra versão publicada corretamente (ou onde queremos
-- forçar consolidação). Limpamos public_id e arquivamos para destravar futuras
-- publicações e remover URLs zumbi.
UPDATE public.budgets b
SET status = 'archived',
    public_id = NULL,
    is_published_version = false
WHERE b.status = 'published'
  AND b.is_published_version = false
  AND b.public_id IS NOT NULL;
