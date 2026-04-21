-- Cache de insights gerados pela IA (análises de reuniões dos consultores)
CREATE TABLE IF NOT EXISTS public.elephant_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE DEFAULT 'consultor_default',
  insights text NOT NULL,
  consultant_name text,
  total_meetings integer NOT NULL DEFAULT 0,
  total_duration_minutes integer NOT NULL DEFAULT 0,
  positive_sentiment_pct integer,
  latest_meeting text,
  charts_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.elephant_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on elephant_insights_cache"
ON public.elephant_insights_cache FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Allow service role write on elephant_insights_cache"
ON public.elephant_insights_cache FOR ALL TO service_role
USING (true) WITH CHECK (true);
