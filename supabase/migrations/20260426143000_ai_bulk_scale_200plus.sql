-- =====================================================================
-- Bulk operations: escalar para 200+ orçamentos com segurança
-- =====================================================================
-- 1) Aceitar todos os action_types já suportados pelo edge function
--    (CHECK original cobria apenas 3).
-- 2) Adicionar colunas de progresso/heartbeat para operações longas que
--    rodam em background via EdgeRuntime.waitUntil (não bloqueiam o HTTP).
-- 3) RPC `bulk_apply_factor_to_items` aplica o fator percentual em massa
--    via UPDATE único (substitui dezenas/centenas de updates row-a-row).
-- 4) RPC `bulk_apply_factor_to_lump_sections` faz o mesmo em sections
--    com preço lump-sum (sem itens).
-- 5) RPC `count_eligible_budgets` permite ao planner saber a contagem
--    antes de chamar o LLM, para apresentar avisos no UX.
-- =====================================================================

-- 1) Expandir CHECK do action_type
ALTER TABLE public.ai_bulk_operations
  DROP CONSTRAINT IF EXISTS ai_bulk_operations_action_type_check;

ALTER TABLE public.ai_bulk_operations
  ADD CONSTRAINT ai_bulk_operations_action_type_check
  CHECK (action_type IN (
    'financial_adjustment',
    'status_change',
    'assign_owner',
    'priority_change',
    'validity_change',
    'due_date_change',
    'pipeline_change',
    'pipeline_stage_change',
    'archive'
  ));

-- 2) Expandir CHECK do status para incluir 'running' (background apply em curso)
ALTER TABLE public.ai_bulk_operations
  DROP CONSTRAINT IF EXISTS ai_bulk_operations_status_check;

ALTER TABLE public.ai_bulk_operations
  ADD CONSTRAINT ai_bulk_operations_status_check
  CHECK (status IN ('pending', 'running', 'applied', 'reverted', 'failed'));

-- 3) Colunas de progresso/heartbeat
ALTER TABLE public.ai_bulk_operations
  ADD COLUMN IF NOT EXISTS progress_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_done  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_phase TEXT,
  ADD COLUMN IF NOT EXISTS heartbeat_at   TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS started_at     TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_ai_bulk_ops_running
  ON public.ai_bulk_operations(status, heartbeat_at DESC)
  WHERE status = 'running';

-- 4) RPC: aplica fator percentual em massa nos items de um conjunto de orçamentos
--    Retorna { items_updated, sections_updated_lump }.
--    Roda em uma única transação no Postgres — milhares de linhas em ms.
CREATE OR REPLACE FUNCTION public.bulk_apply_factor_to_items(
  _budget_ids UUID[],
  _factor     NUMERIC
)
RETURNS TABLE (items_updated BIGINT, lump_sections_updated BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items   BIGINT := 0;
  v_lump    BIGINT := 0;
BEGIN
  -- Apenas admins podem invocar
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  IF _factor IS NULL OR _factor <= 0 OR _factor > 10 THEN
    RAISE EXCEPTION 'invalid factor: %', _factor;
  END IF;

  -- 4a) Items com internal_unit_price > 0
  WITH target_sections AS (
    SELECT id FROM public.sections WHERE budget_id = ANY(_budget_ids)
  ),
  upd_items AS (
    UPDATE public.items i
       SET internal_unit_price = i.internal_unit_price * _factor
     WHERE i.section_id IN (SELECT id FROM target_sections)
       AND i.internal_unit_price IS NOT NULL
       AND i.internal_unit_price > 0
    RETURNING i.id
  )
  SELECT COUNT(*) INTO v_items FROM upd_items;

  -- 4b) Items que usam apenas internal_total (não foram tocados acima)
  WITH target_sections AS (
    SELECT id FROM public.sections WHERE budget_id = ANY(_budget_ids)
  ),
  upd_items_total AS (
    UPDATE public.items i
       SET internal_total = i.internal_total * _factor
     WHERE i.section_id IN (SELECT id FROM target_sections)
       AND (i.internal_unit_price IS NULL OR i.internal_unit_price = 0)
       AND i.internal_total IS NOT NULL
       AND i.internal_total > 0
    RETURNING i.id
  )
  SELECT v_items + COUNT(*) INTO v_items FROM upd_items_total;

  -- 4c) Sections com preço lump-sum (sem itens)
  WITH lump AS (
    UPDATE public.sections s
       SET section_price = s.section_price * _factor
     WHERE s.budget_id = ANY(_budget_ids)
       AND s.section_price IS NOT NULL
       AND s.section_price > 0
       AND NOT EXISTS (SELECT 1 FROM public.items it WHERE it.section_id = s.id)
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_lump FROM lump;

  RETURN QUERY SELECT v_items, v_lump;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_apply_factor_to_items(UUID[], NUMERIC) TO authenticated;

-- 5) RPC: contagem prévia (sem LLM) — usada pelo planner para alertar o usuário
CREATE OR REPLACE FUNCTION public.count_eligible_budgets(
  _internal_status TEXT[] DEFAULT NULL,
  _pipeline_stage  TEXT[] DEFAULT NULL,
  _created_from    DATE   DEFAULT NULL,
  _created_to      DATE   DEFAULT NULL,
  _exclude_protected BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_protected TEXT[] := ARRAY['contrato_fechado','perdido','lost','archived']::TEXT[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.budgets b
   WHERE (b.is_current_version IS NULL OR b.is_current_version = TRUE)
     AND (_internal_status IS NULL OR b.internal_status = ANY(_internal_status))
     AND (_pipeline_stage  IS NULL OR b.pipeline_stage  = ANY(_pipeline_stage))
     AND (_created_from    IS NULL OR b.created_at >= _created_from::TIMESTAMP)
     AND (_created_to      IS NULL OR b.created_at <  (_created_to + INTERVAL '1 day'))
     AND (_exclude_protected = FALSE OR NOT (b.internal_status = ANY(v_protected)));

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_eligible_budgets(TEXT[], TEXT[], DATE, DATE, BOOLEAN) TO authenticated;

-- 6) Comentários para discoverability
COMMENT ON FUNCTION public.bulk_apply_factor_to_items(UUID[], NUMERIC) IS
  'Aplica fator percentual (>0) a items.internal_unit_price (ou internal_total) e sections lump-sum dos orçamentos passados. Admin-only.';

COMMENT ON FUNCTION public.count_eligible_budgets(TEXT[], TEXT[], DATE, DATE, BOOLEAN) IS
  'Conta orçamentos elegíveis para ações em massa, antes de chamar a IA. Admin-only.';

COMMENT ON COLUMN public.ai_bulk_operations.progress_total IS 'Total de unidades a processar (orçamentos clonados + items atualizados).';
COMMENT ON COLUMN public.ai_bulk_operations.progress_done  IS 'Unidades já processadas (atualizado durante apply em background).';
COMMENT ON COLUMN public.ai_bulk_operations.progress_phase IS 'Fase corrente: cloning | applying_factor | status_update | events | done.';
COMMENT ON COLUMN public.ai_bulk_operations.heartbeat_at   IS 'Última atualização do worker em background — usado para detectar travamento.';
