-- 1. Função BEFORE INSERT/UPDATE em budgets para sincronizar pipeline_stage e win_probability
CREATE OR REPLACE FUNCTION public.sync_pipeline_stage_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_stage text;
BEGIN
  -- Sempre deriva o stage a partir do internal_status atual
  _new_stage := public.derive_pipeline_stage(NEW.internal_status);

  -- Em INSERT, sempre define
  IF TG_OP = 'INSERT' THEN
    NEW.pipeline_stage := _new_stage;
    IF NEW.win_probability IS NULL THEN
      NEW.win_probability := public.default_win_probability(_new_stage);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Em UPDATE, só sincroniza se internal_status mudou
    IF NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN
      NEW.pipeline_stage := _new_stage;
      -- Só atualiza probabilidade se usuário não a alterou manualmente neste update
      IF NEW.win_probability IS NULL OR NEW.win_probability = OLD.win_probability THEN
        NEW.win_probability := public.default_win_probability(_new_stage);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove triggers antigos se existirem
DROP TRIGGER IF EXISTS sync_pipeline_stage_trg ON public.budgets;
DROP TRIGGER IF EXISTS sync_pipeline_stage_insert_trg ON public.budgets;
DROP TRIGGER IF EXISTS sync_pipeline_stage_update_trg ON public.budgets;

-- Trigger único BEFORE INSERT OR UPDATE
CREATE TRIGGER sync_pipeline_stage_trg
  BEFORE INSERT OR UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pipeline_stage_on_change();

-- 2. Backfill das linhas com pipeline_stage NULL
UPDATE public.budgets
SET pipeline_stage = public.derive_pipeline_stage(internal_status),
    win_probability = COALESCE(win_probability, public.default_win_probability(public.derive_pipeline_stage(internal_status)))
WHERE pipeline_stage IS NULL;

-- 3. Vincula create_mql_budget_for_new_client como AFTER INSERT em clients
DROP TRIGGER IF EXISTS create_mql_budget_for_new_client_trg ON public.clients;

CREATE TRIGGER create_mql_budget_for_new_client_trg
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_mql_budget_for_new_client();

-- 4. Garante log de mudança de status (caso o trigger esteja faltando)
DROP TRIGGER IF EXISTS log_internal_status_change_trg ON public.budgets;

CREATE TRIGGER log_internal_status_change_trg
  AFTER UPDATE OF internal_status ON public.budgets
  FOR EACH ROW
  WHEN (NEW.internal_status IS DISTINCT FROM OLD.internal_status)
  EXECUTE FUNCTION public.log_internal_status_change();