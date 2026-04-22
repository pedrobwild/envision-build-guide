-- ============================================================
-- Idempotência do Digisac webhook
-- ============================================================
-- 1. Constraints únicas em conversas e mensagens (evita corrida
--    entre webhooks reentregues em paralelo).
-- 2. Tabela de eventos processados (dedup por hash do payload).
-- ============================================================

-- ---------- Conversas: única por (provider, external_id) ----------
-- Limpa duplicatas históricas, se existirem (mantém a mais antiga).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY provider, external_id
           ORDER BY created_at ASC
         ) AS rn
  FROM public.budget_conversations
  WHERE external_id IS NOT NULL
)
DELETE FROM public.budget_conversations c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS budget_conversations_provider_external_uidx
  ON public.budget_conversations (provider, external_id)
  WHERE external_id IS NOT NULL;

-- ---------- Mensagens: única por (conversation_id, external_id) ----------
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY conversation_id, external_id
           ORDER BY created_at ASC
         ) AS rn
  FROM public.budget_conversation_messages
  WHERE external_id IS NOT NULL
)
DELETE FROM public.budget_conversation_messages m
USING ranked r
WHERE m.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS budget_conv_messages_conv_external_uidx
  ON public.budget_conversation_messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;

-- ---------- Tabela de dedup de eventos do webhook ----------
CREATE TABLE IF NOT EXISTS public.digisac_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text,
  external_message_id text,
  external_ticket_id text,
  external_contact_id text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digisac_webhook_events_received_at_idx
  ON public.digisac_webhook_events (received_at DESC);

ALTER TABLE public.digisac_webhook_events ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode auditar; service role bypassa RLS automaticamente.
DROP POLICY IF EXISTS "digisac_webhook_events admin select"
  ON public.digisac_webhook_events;
CREATE POLICY "digisac_webhook_events admin select"
  ON public.digisac_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------- Limpeza periódica (chamada pelo job ou manualmente) ----------
CREATE OR REPLACE FUNCTION public.cleanup_old_digisac_webhook_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.digisac_webhook_events
   WHERE received_at < (now() - INTERVAL '7 days');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;