-- =========================================================================
-- FASE 1: Infraestrutura de leads — índices, normalização, routing, retenção
-- =========================================================================

-- 1) Índice único em lead_sources(source, external_id) para dedup robusta
CREATE UNIQUE INDEX IF NOT EXISTS lead_sources_source_external_id_uniq
  ON public.lead_sources (source, external_id)
  WHERE external_id IS NOT NULL;

-- 2) Função de normalização de telefone (apenas dígitos, mantém DDI BR opcional)
CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RETURN NULL;
  END IF;
  -- Remove tudo que não é dígito
  digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF length(digits) = 0 THEN
    RETURN NULL;
  END IF;
  -- Se começar com 55 (BR) e tiver 12-13 dígitos, remove o 55 para padronizar
  IF length(digits) >= 12 AND left(digits, 2) = '55' THEN
    digits := substring(digits FROM 3);
  END IF;
  RETURN digits;
END;
$$;

-- 3) Coluna phone_normalized em clients (gerada automaticamente)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (public.normalize_phone(phone)) STORED;

CREATE INDEX IF NOT EXISTS clients_phone_normalized_idx
  ON public.clients (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- 4) Atualizar trigger create_mql_budget_for_new_client para herdar tracking
CREATE OR REPLACE FUNCTION public.create_mql_budget_for_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip se já existe budget para o cliente
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
    -- Tracking herdado do cliente
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
    utm_term
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
    NEW.utm_term
  );

  RETURN NEW;
END;
$$;

-- 5) Tabela de regras de roteamento de leads
CREATE TABLE IF NOT EXISTS public.lead_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,        -- menor = avaliado primeiro
  -- Critérios (todos opcionais; AND entre eles)
  match_source text,                            -- ex: 'meta_ads', 'google_ads'
  match_campaign_id text,
  match_campaign_name_ilike text,               -- ex: '%brooklin%'
  match_form_id text,
  match_city_ilike text,
  -- Ação
  assignment_strategy text NOT NULL DEFAULT 'fixed', -- 'fixed' | 'round_robin'
  assigned_owner_id uuid,                       -- usado se strategy='fixed'
  round_robin_pool uuid[],                      -- usado se strategy='round_robin'
  round_robin_cursor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS lead_routing_rules_active_priority_idx
  ON public.lead_routing_rules (is_active, priority)
  WHERE is_active = true;

ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage routing rules"
  ON public.lead_routing_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read routing rules"
  ON public.lead_routing_rules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages routing rules"
  ON public.lead_routing_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER tg_lead_routing_rules_updated_at
  BEFORE UPDATE ON public.lead_routing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Função RPC: resolve owner para um lead recém-chegado
CREATE OR REPLACE FUNCTION public.resolve_lead_owner(
  p_source text,
  p_campaign_id text DEFAULT NULL,
  p_campaign_name text DEFAULT NULL,
  p_form_id text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule RECORD;
  picked uuid;
  pool_size integer;
  next_cursor integer;
BEGIN
  FOR rule IN
    SELECT *
    FROM public.lead_routing_rules
    WHERE is_active = true
      AND (match_source IS NULL OR match_source = p_source)
      AND (match_campaign_id IS NULL OR match_campaign_id = p_campaign_id)
      AND (match_campaign_name_ilike IS NULL OR p_campaign_name ILIKE match_campaign_name_ilike)
      AND (match_form_id IS NULL OR match_form_id = p_form_id)
      AND (match_city_ilike IS NULL OR p_city ILIKE match_city_ilike)
    ORDER BY priority ASC, created_at ASC
  LOOP
    IF rule.assignment_strategy = 'fixed' AND rule.assigned_owner_id IS NOT NULL THEN
      RETURN rule.assigned_owner_id;
    ELSIF rule.assignment_strategy = 'round_robin'
          AND rule.round_robin_pool IS NOT NULL
          AND array_length(rule.round_robin_pool, 1) > 0 THEN
      pool_size := array_length(rule.round_robin_pool, 1);
      next_cursor := (rule.round_robin_cursor % pool_size) + 1;
      picked := rule.round_robin_pool[next_cursor];
      UPDATE public.lead_routing_rules
        SET round_robin_cursor = next_cursor
        WHERE id = rule.id;
      RETURN picked;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- 7) Notificação automática quando lead chega via webhook
CREATE OR REPLACE FUNCTION public.notify_owner_on_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só notifica se veio de fonte externa (webhook) e tem owner
  IF NEW.external_source IS NOT NULL
     AND NEW.commercial_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, read)
    VALUES (
      NEW.commercial_owner_id,
      'new_lead',
      'Novo lead recebido',
      COALESCE(NEW.name, 'Lead sem nome')
        || ' · ' || COALESCE(NEW.external_source, 'externo')
        || COALESCE(' · ' || NEW.campaign_name, ''),
      false
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_clients_notify_new_lead ON public.clients;
CREATE TRIGGER tg_clients_notify_new_lead
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_owner_on_new_lead();

-- 8) Função de retenção: arquiva raw_payload antigos (> 6 meses) sem deletar a linha
CREATE OR REPLACE FUNCTION public.archive_old_lead_payloads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.lead_sources
    SET raw_payload = jsonb_build_object('archived', true, 'archived_at', now())
    WHERE received_at < (now() - INTERVAL '6 months')
      AND processing_status = 'processed'
      AND NOT (raw_payload ? 'archived');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 9) Função para reprocessar leads falhados (chamada por edge function ou cron)
CREATE OR REPLACE FUNCTION public.list_failed_lead_sources(p_limit integer DEFAULT 50)
RETURNS SETOF public.lead_sources
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.lead_sources
  WHERE processing_status = 'failed'
    AND received_at > (now() - INTERVAL '7 days')
  ORDER BY received_at DESC
  LIMIT p_limit;
$$;