-- Tabela para persistir o histórico de diagnósticos gerados pela IA operacional
CREATE TABLE public.operations_insights_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID,
  period_from TIMESTAMP WITH TIME ZONE NOT NULL,
  period_to TIMESTAMP WITH TIME ZONE NOT NULL,
  period_days INTEGER NOT NULL,
  health_diagnosis TEXT NOT NULL,
  health_score INTEGER,
  executive_summary TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  kpis_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas temporais e filtros por diagnóstico
CREATE INDEX idx_ops_insights_generated_at ON public.operations_insights_history (generated_at DESC);
CREATE INDEX idx_ops_insights_health ON public.operations_insights_history (health_diagnosis);

-- RLS
ALTER TABLE public.operations_insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage insights history"
  ON public.operations_insights_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert insights"
  ON public.operations_insights_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read insights history"
  ON public.operations_insights_history
  FOR SELECT
  TO authenticated
  USING (true);