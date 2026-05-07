-- 1) Atualiza guard para permitir media_config em publicados
CREATE OR REPLACE FUNCTION public.guard_published_budget_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_safe_cols text[] := ARRAY[
    'view_count','last_viewed_at','deleted_at','deleted_by','updated_at',
    'is_published_version','status','published_at','public_id','date',
    'internal_status','internal_deadline','priority',
    'commercial_owner_id','estimator_owner_id','internal_notes',
    'is_current_version',
    'property_id','client_id','pipeline_id','pipeline_stage',
    'closed_at','contract_file_url','win_probability',
    'briefing','demand_context','reference_links','hubspot_deal_url',
    'client_phone','floor_plan_url',
    'media_config'
  ];
  v_changed_col text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  IF COALESCE(OLD.is_published_version, false) = false THEN
    RETURN NEW;
  END IF;

  FOR v_changed_col IN
    SELECT key FROM jsonb_each(v_new)
    WHERE v_new->key IS DISTINCT FROM v_old->key
  LOOP
    IF NOT (v_changed_col = ANY(v_safe_cols)) THEN
      RAISE EXCEPTION 'published_budget_immutable'
        USING DETAIL = format('coluna %s não pode ser alterada em orçamento publicado', v_changed_col);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 2) Tabela media_change_log
CREATE TABLE public.media_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  public_id text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL CHECK (change_type IN ('upload','delete','reorder','replace','sync','manual_correction','clear')),
  old_media_config jsonb,
  new_media_config jsonb,
  source text NOT NULL DEFAULT 'web_app',
  notes text
);

CREATE INDEX idx_media_change_log_budget ON public.media_change_log(budget_id, changed_at DESC);
CREATE INDEX idx_media_change_log_public ON public.media_change_log(public_id, changed_at DESC);

ALTER TABLE public.media_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read media_change_log"
  ON public.media_change_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team reads media_change_log of accessible budgets"
  ON public.media_change_log FOR SELECT TO authenticated
  USING (can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Service role manages media_change_log"
  ON public.media_change_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Trigger de auditoria
CREATE OR REPLACE FUNCTION public.log_media_config_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_count int;
  v_new_count int;
  v_change_type text;
  v_source text;
  v_role text;
  v_old_sorted jsonb;
  v_new_sorted jsonb;
BEGIN
  v_old_count := COALESCE(jsonb_array_length(OLD.media_config->'projeto3d'),0)
               + COALESCE(jsonb_array_length(OLD.media_config->'fotos'),0)
               + COALESCE(jsonb_array_length(OLD.media_config->'projetoExecutivo'),0);
  v_new_count := COALESCE(jsonb_array_length(NEW.media_config->'projeto3d'),0)
               + COALESCE(jsonb_array_length(NEW.media_config->'fotos'),0)
               + COALESCE(jsonb_array_length(NEW.media_config->'projetoExecutivo'),0);

  IF v_new_count > v_old_count THEN
    v_change_type := 'upload';
  ELSIF v_new_count < v_old_count THEN
    v_change_type := CASE WHEN v_new_count = 0 THEN 'clear' ELSE 'delete' END;
  ELSE
    -- mesma quantidade: detecta replace vs reorder comparando conjuntos ordenados
    SELECT COALESCE(jsonb_agg(value::text ORDER BY value::text), '[]'::jsonb)
      INTO v_new_sorted
      FROM jsonb_array_elements(COALESCE(NEW.media_config->'projeto3d','[]'::jsonb));
    SELECT COALESCE(jsonb_agg(value::text ORDER BY value::text), '[]'::jsonb)
      INTO v_old_sorted
      FROM jsonb_array_elements(COALESCE(OLD.media_config->'projeto3d','[]'::jsonb));

    IF v_new_sorted IS DISTINCT FROM v_old_sorted THEN
      v_change_type := 'replace';
    ELSE
      -- testa fotos também
      SELECT COALESCE(jsonb_agg(value::text ORDER BY value::text), '[]'::jsonb)
        INTO v_new_sorted
        FROM jsonb_array_elements(COALESCE(NEW.media_config->'fotos','[]'::jsonb));
      SELECT COALESCE(jsonb_agg(value::text ORDER BY value::text), '[]'::jsonb)
        INTO v_old_sorted
        FROM jsonb_array_elements(COALESCE(OLD.media_config->'fotos','[]'::jsonb));
      IF v_new_sorted IS DISTINCT FROM v_old_sorted THEN
        v_change_type := 'replace';
      ELSE
        v_change_type := 'reorder';
      END IF;
    END IF;
  END IF;

  BEGIN
    v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;
  v_source := CASE WHEN v_role = 'service_role' THEN 'edge_function' ELSE 'web_app' END;

  INSERT INTO public.media_change_log(
    budget_id, public_id, changed_by, change_type,
    old_media_config, new_media_config, source
  ) VALUES (
    NEW.id, NEW.public_id, auth.uid(), v_change_type,
    OLD.media_config, NEW.media_config, v_source
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER log_media_config_changes_trg
AFTER UPDATE OF media_config ON public.budgets
FOR EACH ROW
WHEN (OLD.media_config IS DISTINCT FROM NEW.media_config)
EXECUTE FUNCTION public.log_media_config_changes();