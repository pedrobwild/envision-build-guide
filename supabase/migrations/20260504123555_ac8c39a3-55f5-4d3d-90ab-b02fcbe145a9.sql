-- 1) Permitir is_current_version na allowlist do guard de publicados
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
    'internal_status','internal_deadline','priority',
    'commercial_owner_id','estimator_owner_id',
    'internal_notes',
    'property_id','client_id','pipeline_id','pipeline_stage',
    'closed_at','contract_file_url','win_probability',
    'is_current_version'
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

-- 2) Saneamento: 1 current por grupo (publicada > maior version_number > mais recente)
WITH ranked AS (
  SELECT
    id,
    version_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY version_group_id
      ORDER BY
        is_published_version DESC NULLS LAST,
        version_number DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM public.budgets
  WHERE version_group_id IS NOT NULL
    AND deleted_at IS NULL
)
UPDATE public.budgets b
SET is_current_version = (r.rn = 1)
FROM ranked r
WHERE b.id = r.id
  AND b.is_current_version IS DISTINCT FROM (r.rn = 1);

-- 3) Trigger preventivo: ao marcar uma versão como current, desmarca as outras do grupo
CREATE OR REPLACE FUNCTION public.enforce_single_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current_version IS TRUE
     AND NEW.version_group_id IS NOT NULL THEN
    UPDATE public.budgets
       SET is_current_version = false
     WHERE version_group_id = NEW.version_group_id
       AND id <> NEW.id
       AND is_current_version = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_current_version ON public.budgets;
CREATE TRIGGER trg_enforce_single_current_version
AFTER INSERT OR UPDATE OF is_current_version, version_group_id
ON public.budgets
FOR EACH ROW
WHEN (NEW.is_current_version IS TRUE)
EXECUTE FUNCTION public.enforce_single_current_version();
