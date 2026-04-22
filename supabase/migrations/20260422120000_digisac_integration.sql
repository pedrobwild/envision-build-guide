-- ============================================================
-- Digisac integration: credenciais, conversas "soltas" (sem budget),
-- status/atribuição do ticket e espelho de contatos.
-- ============================================================

-- 1. digisac_config (armazena token da API + URL base + webhook secret).
--    Apenas uma linha deve existir (enforced pela trigger abaixo).
CREATE TABLE IF NOT EXISTS public.digisac_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_base_url text NOT NULL DEFAULT 'https://app.digisac.biz/api/v1',
  api_token text,
  webhook_secret text,
  default_service_id text,
  default_user_id text,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Garante apenas uma linha de configuração.
CREATE UNIQUE INDEX IF NOT EXISTS digisac_config_singleton_idx
  ON public.digisac_config ((true));

ALTER TABLE public.digisac_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage digisac config" ON public.digisac_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access digisac config" ON public.digisac_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_digisac_config_updated_at
  BEFORE UPDATE ON public.digisac_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Ajustes em budget_conversations:
--    - budget_id passa a ser nullable (conversas sem match ficam "órfãs").
--    - Colunas extras: status, assigned, último preview, metadata do provider.
-- ============================================================
ALTER TABLE public.budget_conversations
  ALTER COLUMN budget_id DROP NOT NULL;

ALTER TABLE public.budget_conversations
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS assigned_user_name text,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS provider_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_budget_conversations_last_message
  ON public.budget_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_budget_conversations_contact
  ON public.budget_conversations (contact_identifier);

-- Política adicional: admins conseguem ver TODAS as conversas, inclusive
-- as órfãs (sem budget). As políticas existentes cobrem o caso com budget.
DROP POLICY IF EXISTS "Admins read all conversations" ON public.budget_conversations;
CREATE POLICY "Admins read all conversations" ON public.budget_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercial reads conversations" ON public.budget_conversations;
CREATE POLICY "Comercial reads conversations" ON public.budget_conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'::app_role));

-- ============================================================
-- 3. Ajustes em budget_conversation_messages:
--    - Colunas extras para mensagens vindas de canais (tipo, status, reply).
-- ============================================================
ALTER TABLE public.budget_conversation_messages
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS reply_to_external_id text,
  ADD COLUMN IF NOT EXISTS provider_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS budget_conv_msgs_external_uidx
  ON public.budget_conversation_messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;

-- Política para admins verem mensagens de conversas órfãs (sem budget).
DROP POLICY IF EXISTS "Admins read all conv messages" ON public.budget_conversation_messages;
CREATE POLICY "Admins read all conv messages" ON public.budget_conversation_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Comercial reads conv messages" ON public.budget_conversation_messages;
CREATE POLICY "Comercial reads conv messages" ON public.budget_conversation_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'::app_role));

-- ============================================================
-- 4. Contatos espelhados do Digisac (para resolver contactId → telefone/nome
--    rapidamente, sem precisar consultar a API toda hora).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.digisac_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  name text,
  phone text,
  email text,
  avatar_url text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digisac_contacts_phone
  ON public.digisac_contacts (phone);

ALTER TABLE public.digisac_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage digisac contacts" ON public.digisac_contacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read digisac contacts" ON public.digisac_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages digisac contacts" ON public.digisac_contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_digisac_contacts_updated_at
  BEFORE UPDATE ON public.digisac_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. Inserir linha padrão de configuração (vazia) se ainda não existir.
-- ============================================================
INSERT INTO public.digisac_config (api_base_url)
SELECT 'https://app.digisac.biz/api/v1'
WHERE NOT EXISTS (SELECT 1 FROM public.digisac_config);
