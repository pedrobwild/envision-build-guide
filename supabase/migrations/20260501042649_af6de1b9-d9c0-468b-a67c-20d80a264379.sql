-- Permite alterar campos de workflow interno (não impactam o conteúdo público
-- do orçamento) mesmo quando o orçamento está publicado. internal_status,
-- internal_deadline, priority, commercial_owner_id e estimator_owner_id são
-- estado operacional e devem ser editáveis para gerenciar produção/comercial
-- após a publicação.
CREATE OR REPLACE FUNCTION public.guard_published_budget_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_cols text[] := ARRAY[]::text[];
  v_safe_cols text[] := ARRAY[
    'view_count','last_viewed_at',
    'deleted_at','deleted_by',
    'updated_at',
    'is_published_version','status','published_at',
    'public_id',
    -- Workflow interno (não afeta conteúdo público):
    'internal_status','internal_deadline','priority',
    'commercial_owner_id','estimator_owner_id',
    'internal_notes'
  ];
BEGIN
  IF COALESCE(OLD.is_published_version, false) = false THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(col)
    INTO v_changed_cols
  FROM (
    SELECT key AS col
      FROM jsonb_each(to_jsonb(NEW)) n
      LEFT JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value
  ) diff;

  IF v_changed_cols IS NULL THEN
    RETURN NEW;
  END IF;

  -- Remove os campos seguros da lista de mudanças.
  v_changed_cols := ARRAY(
    SELECT c FROM unnest(v_changed_cols) c
    WHERE c <> ALL(v_safe_cols)
  );

  IF array_length(v_changed_cols, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'published_budget_immutable: tentativa de alterar campo(s) {%} em orçamento publicado (id=%). Crie uma nova versão (fork) antes de editar.',
    array_to_string(v_changed_cols, ','),
    OLD.id
    USING ERRCODE = 'check_violation',
          HINT = 'Use duplicateBudgetAsVersion() para criar uma nova versão editável.';
END;
$function$;