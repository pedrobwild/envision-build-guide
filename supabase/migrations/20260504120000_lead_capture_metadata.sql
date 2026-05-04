-- =========================================================================
-- Campos de captura para leads importados via planilha (Meta / Google Sheets)
-- =========================================================================
-- Mapeamento das colunas da planilha que ainda não existiam no schema:
--   - "Data/Hora do lead" -> lead_captured_at (timestamptz)
--   - "Plataforma"        -> platform (text)
--
-- As demais colunas da planilha já existem:
--   - "Campanha"              -> campaign_name
--   - "Conjunto de anúncios"  -> adset_name
--   - "Anúncio"               -> ad_name
--   - "ID Lead Meta"          -> external_lead_id (com external_source='meta_ads')

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform text;

ALTER TABLE public.lead_sources
  ADD COLUMN IF NOT EXISTS lead_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform text;

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS lead_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform text;

CREATE INDEX IF NOT EXISTS clients_lead_captured_at_idx
  ON public.clients (lead_captured_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS lead_sources_platform_idx
  ON public.lead_sources (platform)
  WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS budgets_platform_idx
  ON public.budgets (platform)
  WHERE platform IS NOT NULL;

-- Atualiza o trigger create_mql_budget_for_new_client para propagar os novos campos
-- do cliente para o budget MQL recém-criado.
CREATE OR REPLACE FUNCTION public.create_mql_budget_for_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.budgets WHERE client_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.budgets (
    client_id,
    client_name,
    client_phone,
    lead_email,
    project_name,
    internal_status,
    status,
    priority,
    created_by,
    commercial_owner_id,
    bairro,
    city,
    external_source,
    external_lead_id,
    form_id,
    campaign_id,
    campaign_name,
    adset_id,
    adset_name,
    ad_id,
    ad_name,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    lead_captured_at,
    platform
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.phone,
    NEW.email,
    COALESCE(NULLIF(NEW.name, ''), 'Novo lead') || ' - MQL',
    'mql',
    'draft',
    'normal',
    NEW.created_by,
    NEW.commercial_owner_id,
    NEW.bairro,
    NEW.city,
    NEW.external_source,
    NEW.external_lead_id,
    NEW.form_id,
    NEW.campaign_id,
    NEW.campaign_name,
    NEW.adset_id,
    NEW.adset_name,
    NEW.ad_id,
    NEW.ad_name,
    NEW.utm_source,
    NEW.utm_medium,
    NEW.utm_campaign,
    NEW.utm_content,
    NEW.utm_term,
    NEW.lead_captured_at,
    NEW.platform
  );

  RETURN NEW;
END;
$$;
