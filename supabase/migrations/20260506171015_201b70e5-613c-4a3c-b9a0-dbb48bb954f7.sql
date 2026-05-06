-- Permite que comerciais movam para a lixeira (soft-delete) qualquer
-- orçamento que conseguem visualizar no Kanban — incluindo os sem
-- commercial_owner_id atribuído. Apaga apenas via UPDATE deleted_at,
-- nunca DELETE físico (consistente com safeDeleteBudget).
-- Mantém policies existentes; adiciona uma nova permissiva específica.

CREATE POLICY "Comercial can soft-delete visible budgets"
ON public.budgets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'comercial'::app_role)
  AND deleted_at IS NULL
  AND (
    commercial_owner_id = auth.uid()
    OR commercial_owner_id IS NULL
  )
)
WITH CHECK (
  has_role(auth.uid(), 'comercial'::app_role)
);