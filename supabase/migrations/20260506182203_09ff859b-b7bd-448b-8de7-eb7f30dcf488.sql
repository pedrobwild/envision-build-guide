-- Comercial: visão completa de todos os orçamentos (exceto excluídos)
CREATE POLICY "Comercial can view all budgets"
ON public.budgets FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'comercial'::app_role) AND deleted_at IS NULL);

-- Comercial: atualizar qualquer orçamento (workflow comercial)
CREATE POLICY "Comercial can update all budgets"
ON public.budgets FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'comercial'::app_role))
WITH CHECK (has_role(auth.uid(), 'comercial'::app_role));