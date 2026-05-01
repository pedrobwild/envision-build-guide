-- ============================================================
-- Hardening: bloqueia mutações em snapshots publicados no nível
-- do banco (defesa em profundidade, independente do frontend).
-- ============================================================

-- Helper: campos que SEMPRE podem ser atualizados em um budget publicado
-- (telemetria/lifecycle que não alteram o conteúdo do snapshot).
-- Lista canônica:
--   - view_count, last_viewed_at  → telemetria de visualização pública
--   - deleted_at, deleted_by      → soft-delete
--   - updated_at                  → housekeeping
--   - is_published_version, status, published_at → permitir despublicar
--   - public_id                    → realocação de link
--
-- Qualquer outra coluna alterada em um budget com is_published_version=true
-- é tratada como tentativa de mutação do snapshot e abortada.

CREATE OR REPLACE FUNCTION public.guard_published_budget_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed_cols text[] := ARRAY[]::text[];
  v_safe_cols text[] := ARRAY[
    'view_count','last_viewed_at',
    'deleted_at','deleted_by',
    'updated_at',
    'is_published_version','status','published_at',
    'public_id'
  ];
BEGIN
  -- Só age em UPDATEs onde a versão atual (OLD) é publicada.
  IF COALESCE(OLD.is_published_version, false) = false THEN
    RETURN NEW;
  END IF;

  -- Admins NÃO bypassam: o objetivo é proteger o snapshot mesmo de
  -- recálculos automáticos que rodem com privilégio elevado.

  -- Detecta colunas que mudaram comparando OLD/NEW como JSONB.
  SELECT array_agg(key)
    INTO v_changed_cols
    FROM (
      SELECT key
        FROM jsonb_each(to_jsonb(NEW))
       WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
    ) diff
   WHERE key <> ALL (v_safe_cols);

  IF v_changed_cols IS NOT NULL AND array_length(v_changed_cols, 1) > 0 THEN
    RAISE EXCEPTION
      'published_budget_immutable: tentativa de alterar campo(s) % em orçamento publicado (id=%). Crie uma nova versão (fork) antes de editar.',
      v_changed_cols, OLD.id
      USING ERRCODE = 'check_violation',
            HINT = 'Campos seguros (telemetria/lifecycle) podem ser alterados; o conteúdo do snapshot não.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_published_budget_update ON public.budgets;
CREATE TRIGGER guard_published_budget_update
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_published_budget_update();

-- ------------------------------------------------------------
-- Sections: qualquer UPDATE/INSERT/DELETE em uma section cujo
-- budget pai é publicado é abortado. Não há "campos seguros" aqui:
-- toda a estrutura faz parte do snapshot.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_published_section_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_id uuid;
  v_is_published boolean;
BEGIN
  v_budget_id := COALESCE(NEW.budget_id, OLD.budget_id);
  IF v_budget_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(is_published_version, false)
    INTO v_is_published
    FROM public.budgets
   WHERE id = v_budget_id;

  IF v_is_published THEN
    RAISE EXCEPTION
      'published_budget_immutable: tentativa de % em section de orçamento publicado (budget_id=%).',
      TG_OP, v_budget_id
      USING ERRCODE = 'check_violation',
            HINT = 'Faça fork do orçamento antes de editar seções.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_published_section_mutation ON public.sections;
CREATE TRIGGER guard_published_section_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_published_section_mutation();

-- ------------------------------------------------------------
-- Items: mesmo princípio — bloqueia qualquer mutação se o budget
-- pai (via section) é publicado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_published_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_id uuid;
  v_is_published boolean;
BEGIN
  v_section_id := COALESCE(NEW.section_id, OLD.section_id);
  IF v_section_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(b.is_published_version, false)
    INTO v_is_published
    FROM public.sections s
    JOIN public.budgets b ON b.id = s.budget_id
   WHERE s.id = v_section_id;

  IF v_is_published THEN
    RAISE EXCEPTION
      'published_budget_immutable: tentativa de % em item de orçamento publicado (section_id=%).',
      TG_OP, v_section_id
      USING ERRCODE = 'check_violation',
            HINT = 'Faça fork do orçamento antes de editar itens.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_published_item_mutation ON public.items;
CREATE TRIGGER guard_published_item_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_published_item_mutation();
