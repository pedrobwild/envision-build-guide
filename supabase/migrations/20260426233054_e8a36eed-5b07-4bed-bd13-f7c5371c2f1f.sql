-- Estende public.bug_reports com triagem automática por IA
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

CREATE INDEX IF NOT EXISTS idx_bug_reports_severity_ai ON public.bug_reports (severity_ai);
CREATE INDEX IF NOT EXISTS idx_bug_reports_area_ai     ON public.bug_reports (area_ai);
CREATE INDEX IF NOT EXISTS idx_bug_reports_triage_tags ON public.bug_reports USING gin (triage_tags);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_bug_reports_title_trgm
  ON public.bug_reports USING gin (title gin_trgm_ops);

CREATE OR REPLACE VIEW public.v_bug_reports_admin AS
SELECT
  b.id, b.title, b.description, b.steps_to_reproduce, b.expected_behavior, b.actual_behavior,
  b.severity, b.severity_ai, b.status, b.route, b.user_role, b.device_type, b.os_name, b.browser_name,
  b.area_ai, b.triage_summary, b.triage_tags, b.duplicate_of,
  b.attachments, b.console_errors, b.reporter_id, b.reporter_name, b.reporter_email,
  b.resolved_at, b.resolved_by, b.created_at, b.updated_at, b.triaged_at
FROM public.bug_reports b;

COMMENT ON VIEW public.v_bug_reports_admin IS
  'Bug reports com triagem por IA. Acessível apenas a admin/orçamentista via RLS da tabela base.';

GRANT SELECT ON public.v_bug_reports_admin TO authenticated;

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
      NULL;
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