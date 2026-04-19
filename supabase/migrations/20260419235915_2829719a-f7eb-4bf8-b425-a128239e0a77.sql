-- Remove o trigger que criava automaticamente um budget MQL/lead ao cadastrar um cliente.
-- A função fica preservada (caso queiramos reativar no futuro), apenas o trigger é removido.
DROP TRIGGER IF EXISTS trg_create_mql_budget_for_new_client ON public.clients;
DROP TRIGGER IF EXISTS create_mql_budget_for_new_client_trigger ON public.clients;
DROP TRIGGER IF EXISTS create_mql_budget_for_new_client ON public.clients;
DROP TRIGGER IF EXISTS clients_create_mql_budget ON public.clients;