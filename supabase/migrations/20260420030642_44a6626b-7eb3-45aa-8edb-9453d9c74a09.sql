
-- Função: move negócios "frios" (sem mudança de status há 30+ dias e sem atividade nos últimos 14 dias)
-- para o pipeline Re-engajamento. Só atua em negócios ainda ativos (não fechados/perdidos)
-- e que ainda não estão no pipeline Re-engajamento.
CREATE OR REPLACE FUNCTION public.run_reengagement_sweep()
RETURNS TABLE(moved_count integer, sample jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reeng_id uuid;
  affected integer := 0;
  sample_rows jsonb;
BEGIN
  SELECT id INTO reeng_id FROM public.deal_pipelines WHERE slug = 'reengajamento' LIMIT 1;
  IF reeng_id IS NULL THEN
    RETURN QUERY SELECT 0, '[]'::jsonb;
    RETURN;
  END IF;

  WITH stale AS (
    SELECT b.id
    FROM public.budgets b
    WHERE b.internal_status NOT IN ('contrato_fechado','perdido','lost','archived')
      AND (b.pipeline_id IS NULL OR b.pipeline_id <> reeng_id)
      AND public.budget_days_in_stage(b.id) >= 30
      AND NOT EXISTS (
        SELECT 1 FROM public.budget_activities a
        WHERE a.budget_id = b.id
          AND a.created_at > now() - INTERVAL '14 days'
      )
  ),
  updated AS (
    UPDATE public.budgets b
    SET pipeline_id = reeng_id,
        updated_at = now()
    FROM stale s
    WHERE b.id = s.id
    RETURNING b.id, b.client_name, b.project_name, b.sequential_code
  )
  SELECT COUNT(*)::int, COALESCE(jsonb_agg(to_jsonb(u)) FILTER (WHERE u.id IS NOT NULL), '[]'::jsonb)
    INTO affected, sample_rows
  FROM updated u;

  -- Log evento em cada negócio movido
  INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
  SELECT (elem->>'id')::uuid,
         'pipeline_moved',
         'Movido automaticamente para Re-engajamento (sem atividade há 30+ dias)',
         jsonb_build_object('reason', 'auto_reengagement', 'pipeline_slug', 'reengajamento'),
         now()
  FROM jsonb_array_elements(sample_rows) elem;

  RETURN QUERY SELECT affected, sample_rows;
END;
$$;
