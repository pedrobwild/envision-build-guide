-- 1. Adicionar campos de tracking de campanha em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_id text,
  ADD COLUMN IF NOT EXISTS form_name text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_lead_id text,
  ADD COLUMN IF NOT EXISTS external_lead_payload jsonb;

-- Índice único para evitar duplicação de leads do mesmo sistema externo
CREATE UNIQUE INDEX IF NOT EXISTS clients_external_lead_unique
  ON public.clients (external_source, external_lead_id)
  WHERE external_source IS NOT NULL AND external_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_campaign_id_idx ON public.clients (campaign_id);
CREATE INDEX IF NOT EXISTS clients_utm_campaign_idx ON public.clients (utm_campaign);

-- 2. Espelhar tracking em budgets (já que cada orçamento pode ter origem própria)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_id text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_lead_id text;

CREATE INDEX IF NOT EXISTS budgets_campaign_id_idx ON public.budgets (campaign_id);
CREATE INDEX IF NOT EXISTS budgets_utm_campaign_idx ON public.budgets (utm_campaign);

-- 3. Tabela de payloads brutos de leads externos (auditoria + reprocessamento)
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                 -- 'meta_ads', 'google_ads', 'site', 'manual', etc.
  external_id text,                     -- ID do lead na origem (lead_id do Meta)
  form_id text,
  form_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processed','failed','duplicate','ignored')),
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_sources_external_unique
  ON public.lead_sources (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lead_sources_status_idx ON public.lead_sources (processing_status);
CREATE INDEX IF NOT EXISTS lead_sources_received_at_idx ON public.lead_sources (received_at DESC);
CREATE INDEX IF NOT EXISTS lead_sources_campaign_idx ON public.lead_sources (campaign_id);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all lead sources"
  ON public.lead_sources
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Comercial can read lead sources"
  ON public.lead_sources
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'::app_role));

CREATE POLICY "Service role manages lead sources"
  ON public.lead_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);