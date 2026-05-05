-- Cleanup pontual: cliente duplicado por erro de digitação manual.
-- Contexto:
--   Cliente real:    9a6fa6de-... "Denise Kanashiro" (telefone 13991722280, com atividade comercial)
--   Duplicata:       40d3cd1c-... "Desise Kanashiro" (mesmo telefone normalizado,
--                    criada manualmente ~22h depois, sem e-mail, 1 orçamento em rascunho,
--                    zero atividade comercial)
-- Decisão validada com Marketing antes de criar o UNIQUE parcial em
-- clients.phone_normalized (próxima migration). Sem este cleanup o índice colide.
-- Optamos por soft-delete (is_active=false / deleted_at) em vez de DELETE para
-- preservar histórico e auditoria.

UPDATE public.clients
   SET is_active = false,
       updated_at = now()
 WHERE id = '40d3cd1c-3500-45d2-bfb1-b155726676a0'
   AND is_active = true;

UPDATE public.budgets
   SET deleted_at = now()
 WHERE id = 'a9ee2248-c30e-46da-84d4-9de28bd2e3c9'
   AND deleted_at IS NULL;