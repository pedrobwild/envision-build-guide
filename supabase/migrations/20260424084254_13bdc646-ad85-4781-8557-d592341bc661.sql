-- Tabela de relatórios de bugs com captura de contexto técnico automático
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaging','resolved','dismissed')),
  -- Contexto técnico capturado automaticamente
  route TEXT,
  user_role TEXT,
  device_type TEXT,                -- mobile / tablet / desktop
  os_name TEXT,
  browser_name TEXT,
  browser_version TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  device_pixel_ratio NUMERIC,
  user_agent TEXT,
  active_filters JSONB DEFAULT '{}'::jsonb,
  console_errors JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  resolution_note TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON public.bug_reports(severity);
CREATE INDEX idx_bug_reports_created_at ON public.bug_reports(created_at DESC);
CREATE INDEX idx_bug_reports_reporter ON public.bug_reports(reporter_id);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode reportar
CREATE POLICY "Authenticated can create bug reports"
ON public.bug_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid() OR reporter_id IS NULL);

-- Reporter vê os seus
CREATE POLICY "Reporter can view own bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid());

-- Admin e orçamentista veem todos
CREATE POLICY "Admins and orcamentistas can view all bug reports"
ON public.bug_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'orcamentista'::app_role));

-- Admin e orçamentista atualizam
CREATE POLICY "Admins and orcamentistas can update bug reports"
ON public.bug_reports FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'orcamentista'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'orcamentista'::app_role));

-- Admin remove
CREATE POLICY "Admins can delete bug reports"
ON public.bug_reports FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();