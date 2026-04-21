-- Cache de insights do Elephan.IA por consultor.
-- Schema alinhado ao contrato esperado pelos componentes
-- (ConsultorPerformance, ConsultorComparison, ConsolidatedInsights)
-- e à edge function 'elephant-insights' que faz o upsert.
CREATE TABLE IF NOT EXISTS public.elephant_insights_cache (
  cache_key text PRIMARY KEY,
  consultant_name text,
  total_meetings integer DEFAULT 0,
  total_duration_minutes integer DEFAULT 0,
  positive_sentiment_pct numeric,
  latest_meeting timestamptz,
  charts_data jsonb DEFAULT '{}'::jsonb,
  insights jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para listagens por padrão de chave (ex: 'user_%')
CREATE INDEX IF NOT EXISTS idx_elephant_insights_cache_key_pattern
  ON public.elephant_insights_cache (cache_key text_pattern_ops);

-- Índice para ordenar por atualização recente
CREATE INDEX IF NOT EXISTS idx_elephant_insights_cache_updated_at
  ON public.elephant_insights_cache (updated_at DESC);

-- Trigger para manter updated_at em sincronia
DROP TRIGGER IF EXISTS trg_elephant_insights_cache_updated_at ON public.elephant_insights_cache;
CREATE TRIGGER trg_elephant_insights_cache_updated_at
  BEFORE UPDATE ON public.elephant_insights_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: leitura para autenticados; escrita restrita a admins e service_role
ALTER TABLE public.elephant_insights_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read insights cache" ON public.elephant_insights_cache;
CREATE POLICY "Authenticated can read insights cache"
  ON public.elephant_insights_cache
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage insights cache" ON public.elephant_insights_cache;
CREATE POLICY "Admins manage insights cache"
  ON public.elephant_insights_cache
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages insights cache" ON public.elephant_insights_cache;
CREATE POLICY "Service role manages insights cache"
  ON public.elephant_insights_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);