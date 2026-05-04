-- RPC: get_budget_time_markers
-- Retorna marcos de tempo de um orçamento para o cabeçalho do detalhe:
--   - created_at: criação do orçamento
--   - current_stage_start: ÚLTIMO status_change cujo to_status = internal_status atual
--                          (cai em created_at quando não houver evento)
--   - frozen_at: PRIMEIRO status_change que entrou em estado final
--                ('contrato_fechado','lost','archived'). NULL se ainda ativo.
--   - is_frozen: internal_status atual está em estado final
--   - reference_at: frozen_at quando congelado, senão now()
--
-- Usado pelo front para exibir "Aberto há X dias" e "Nesta etapa há X dias"
-- de forma consistente, sem reprocessar a lista de eventos no cliente.
CREATE OR REPLACE FUNCTION public.get_budget_time_markers(p_budget_id uuid)
RETURNS TABLE (
  budget_id uuid,
  internal_status text,
  created_at timestamptz,
  current_stage_start timestamptz,
  frozen_at timestamptz,
  is_frozen boolean,
  reference_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_created timestamptz;
  v_frozen timestamptz;
  v_stage_start timestamptz;
  v_is_frozen boolean;
  v_final_set text[] := ARRAY['contrato_fechado','lost','archived'];
BEGIN
  SELECT b.internal_status, b.created_at
    INTO v_status, v_created
  FROM public.budgets b
  WHERE b.id = p_budget_id;

  IF v_status IS NULL THEN
    RETURN; -- RLS bloqueou ou id inexistente
  END IF;

  v_is_frozen := v_status = ANY(v_final_set);

  IF v_is_frozen THEN
    SELECT e.created_at
      INTO v_frozen
    FROM public.budget_events e
    WHERE e.budget_id = p_budget_id
      AND e.event_type = 'status_change'
      AND e.to_status = ANY(v_final_set)
    ORDER BY e.created_at ASC
    LIMIT 1;
  END IF;

  SELECT e.created_at
    INTO v_stage_start
  FROM public.budget_events e
  WHERE e.budget_id = p_budget_id
    AND e.event_type = 'status_change'
    AND e.to_status = v_status
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_stage_start IS NULL THEN
    v_stage_start := v_created;
  END IF;

  RETURN QUERY SELECT
    p_budget_id,
    v_status,
    v_created,
    v_stage_start,
    v_frozen,
    v_is_frozen,
    COALESCE(v_frozen, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_time_markers(uuid) TO authenticated;
