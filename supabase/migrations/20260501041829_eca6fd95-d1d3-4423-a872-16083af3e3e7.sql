-- Permite que usuários autenticados criem notificações para outros usuários
-- desde que estejam vinculadas a um orçamento ao qual o autor tem acesso.
-- Necessário para fluxos como "Solicitar revisão" (comercial → orçamentista),
-- onde quem envia não é o destinatário.

CREATE POLICY "Authenticated can insert notifications on accessible budgets"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  budget_id IS NOT NULL
  AND public.can_access_budget(auth.uid(), budget_id)
);