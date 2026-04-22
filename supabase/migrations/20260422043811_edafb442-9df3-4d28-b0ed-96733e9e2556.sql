-- ============================================================
-- Digisac Integration
-- ============================================================

-- ------------------------------------------------------------
-- 1. digisac_config (singleton)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digisac_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  api_token text,
  api_base_url text NOT NULL DEFAULT 'https://app.digisac.me/api/v1',
  webhook_secret text,
  default_service_id text,
  default_user_id text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digisac_config_singleton_unique UNIQUE (singleton)
);

ALTER TABLE public.digisac_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read digisac_config" ON public.digisac_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins write digisac_config" ON public.digisac_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages digisac_config" ON public.digisac_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_digisac_config_updated_at
  BEFORE UPDATE ON public.digisac_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.digisac_config (singleton, api_base_url, enabled)
VALUES (true, 'https://app.digisac.me/api/v1', true)
ON CONFLICT (singleton) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Enriquecimento de budget_conversations
-- ------------------------------------------------------------
ALTER TABLE public.budget_conversations
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS assigned_user_name text,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS provider_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_budget_conversations_last_msg
  ON public.budget_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_budget_conversations_contact_id
  ON public.budget_conversations (contact_identifier);
CREATE INDEX IF NOT EXISTS idx_budget_conversations_provider_status
  ON public.budget_conversations (provider, status);

-- ------------------------------------------------------------
-- 3. Enriquecimento de budget_conversation_messages
-- ------------------------------------------------------------
ALTER TABLE public.budget_conversation_messages
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reply_to_external_id text,
  ADD COLUMN IF NOT EXISTS provider_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS budget_conv_msgs_conv_external_uidx
  ON public.budget_conversation_messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. digisac_contacts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digisac_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text,
  phone_raw text,
  phone_normalized text,
  email text,
  avatar_url text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digisac_contacts_phone
  ON public.digisac_contacts (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_digisac_contacts_email
  ON public.digisac_contacts (email);

ALTER TABLE public.digisac_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view digisac_contacts" ON public.digisac_contacts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'comercial'::app_role));

CREATE POLICY "Service role manages digisac_contacts" ON public.digisac_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_digisac_contacts_updated_at
  BEFORE UPDATE ON public.digisac_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();