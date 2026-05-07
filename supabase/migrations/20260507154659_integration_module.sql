-- Módulo de Integração (admin → /admin/integracao)
-- Tabelas para tokens pessoais e webhooks externos (Zapier, Make, etc).

-- pgcrypto p/ digest()/gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Personal Access Tokens
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_access_tokens_created_by_idx
  ON public.personal_access_tokens (created_by);

ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam tokens pessoais"
  ON public.personal_access_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Integration Webhooks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  description text,
  last_triggered_at timestamptz,
  last_status text,
  failure_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_webhooks_active_idx
  ON public.integration_webhooks (active);

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam webhooks de integração"
  ON public.integration_webhooks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_integration_webhooks_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS integration_webhooks_set_updated_at ON public.integration_webhooks;
CREATE TRIGGER integration_webhooks_set_updated_at
  BEFORE UPDATE ON public.integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.tg_integration_webhooks_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: gerar token (retorna o valor em claro UMA vez)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_personal_access_token(
  p_name text,
  p_scopes text[] DEFAULT ARRAY['read']::text[],
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  token text,
  token_prefix text,
  name text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw    text;
  v_token  text;
  v_prefix text;
  v_hash   text;
  v_id     uuid;
  v_now    timestamptz := now();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem gerar tokens.'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'O nome do token é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  v_raw    := encode(gen_random_bytes(32), 'hex');
  v_token  := 'bwild_pat_' || v_raw;
  v_prefix := left(v_token, 14);
  v_hash   := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.personal_access_tokens (
    name, token_prefix, token_hash, scopes, expires_at, created_by, created_at
  )
  VALUES (
    btrim(p_name),
    v_prefix,
    v_hash,
    coalesce(p_scopes, ARRAY['read']::text[]),
    p_expires_at,
    auth.uid(),
    v_now
  )
  RETURNING personal_access_tokens.id INTO v_id;

  RETURN QUERY
    SELECT v_id, v_token, v_prefix, btrim(p_name), p_expires_at, v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_personal_access_token(text, text[], timestamptz)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: revogar token
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_personal_access_token(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem revogar tokens.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.personal_access_tokens
     SET revoked_at = now()
   WHERE id = p_id
     AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_personal_access_token(uuid) TO authenticated;
