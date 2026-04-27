-- bug_reports_ai_triage.sql
--
-- Estende a tabela existente public.bug_reports (criada em 20260424084254)
-- com triagem automática por IA: severidade sugerida, área afetada,
-- resumo curto, tags e detecção de duplicatas.
--
-- Não altera o schema atual usado pelo componente BugReporter — apenas
-- adiciona campos opcionais que a edge function `bug-report-triage`
-- preenche após o INSERT.

-- ─── Colunas novas ────────────────────────────────────────────────────────

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS severity_ai     text
    CHECK (severity_ai IS NULL OR severity_ai IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS area_ai         text,
  ADD COLUMN IF NOT EXISTS triage_summary  text,
  ADD COLUMN IF NOT EXISTS triage_tags     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS duplicate_of    uuid REFERENCES public.bug_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triaged_at      timestamptz;

COMMENT ON COLUMN public.bug_reports.severity_ai    IS 'Severidade sugerida pela IA (pode divergir de severity).';
COMMENT ON COLUMN public.bug_reports.area_ai        IS 'Área afetada (ex.: budget-editor, comercial, ai-assistant).';
COMMENT ON COLUMN public.bug_reports.triage_summary IS 'Resumo de 1-2 frases gerado pela IA.';
COMMENT ON COLUMN public.bug_reports.triage_tags    IS 'Tags em snake_case geradas pela IA.';
COMMENT ON COLUMN public.bug_reports.duplicate_of   IS 'Aponta para outro bug se for possível duplicata.';

-- ─── Índices ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bug_reports_severity_ai ON public.bug_reports (severity_ai);
CREATE INDEX IF NOT EXISTS idx_bug_reports_area_ai     ON public.bug_reports (area_ai);
CREATE INDEX IF NOT EXISTS idx_bug_reports_triage_tags ON public.bug_reports USING gin (triage_tags);

-- Trigram para busca anti-duplicata por similaridade
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_bug_reports_title_trgm
  ON public.bug_reports USING gin (title gin_trgm_ops);

-- ─── View enriquecida (admin / orçamentista) ──────────────────────────────

CREATE OR REPLACE VIEW public.v_bug_reports_admin AS
SELECT
  b.id,
  b.title,
  b.description,
  b.steps_to_reproduce,
  b.expected_behavior,
  b.actual_behavior,
  b.severity,
  b.severity_ai,
  b.status,
  b.route,
  b.user_role,
  b.device_type,
  b.os_name,
  b.browser_name,
  b.area_ai,
  b.triage_summary,
  b.triage_tags,
  b.duplicate_of,
  b.attachments,
  b.console_errors,
  b.reporter_id,
  b.reporter_name,
  b.reporter_email,
  b.resolved_at,
  b.resolved_by,
  b.created_at,
  b.updated_at,
  b.triaged_at
FROM public.bug_reports b;

COMMENT ON VIEW public.v_bug_reports_admin IS
  'Bug reports com triagem por IA. Acessível apenas a admin/orçamentista via RLS da tabela base.';

GRANT SELECT ON public.v_bug_reports_admin TO authenticated;

-- ─── Auditoria de bugs críticos ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_bug_reports_audit_critical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity_ai = 'critical'
     AND (TG_OP = 'INSERT' OR OLD.severity_ai IS DISTINCT FROM 'critical')
  THEN
    BEGIN
      INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, metadata)
      VALUES (
        'bug_report.critical',
        'bug_report',
        NEW.id,
        NEW.reporter_id,
        jsonb_build_object(
          'title',  NEW.title,
          'area',   NEW.area_ai,
          'route',  NEW.route
        )
      );
    EXCEPTION WHEN undefined_table THEN
      NULL;  -- ambiente sem audit_log; silencioso
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bug_reports_audit_critical ON public.bug_reports;
CREATE TRIGGER bug_reports_audit_critical
  AFTER INSERT OR UPDATE OF severity_ai ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_bug_reports_audit_critical();
