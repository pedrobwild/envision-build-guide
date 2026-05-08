-- ============================================================
-- Personal Access Tokens + Integration Webhooks
-- ============================================================

-- ── Tokens pessoais ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_access_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  token_hash    text NOT NULL UNIQUE,
  token_prefix  text NOT NULL,
  scopes        text[] NOT NULL DEFAULT ARRAY['read']::text[],
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pat_user ON public.personal_access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pat_hash ON public.personal_access_tokens(token_hash);

ALTER TABLE public.personal_access_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all tokens" ON public.personal_access_tokens;
CREATE POLICY "Admins manage all tokens"
  ON public.personal_access_tokens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users see own tokens" ON public.personal_access_tokens;
CREATE POLICY "Users see own tokens"
  ON public.personal_access_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ── Webhooks de integração ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  url               text NOT NULL,
  secret            text,
  events            text[] NOT NULL DEFAULT ARRAY[]::text[],
  active            boolean NOT NULL DEFAULT true,
  description       text,
  last_triggered_at timestamptz,
  last_status       text,
  failure_count     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_iw_active ON public.integration_webhooks(active);

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage webhooks" ON public.integration_webhooks;
CREATE POLICY "Admins manage webhooks"
  ON public.integration_webhooks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_iw_updated_at ON public.integration_webhooks;
CREATE TRIGGER trg_iw_updated_at
  BEFORE UPDATE ON public.integration_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── RPC: gerar token ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_personal_access_token(
  p_name       text,
  p_scopes     text[],
  p_expires_at timestamptz
)
RETURNS TABLE (id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_raw       text;
  v_token     text;
  v_hash      text;
  v_prefix    text;
  v_id        uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem gerar tokens';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;
  IF p_scopes IS NULL OR array_length(p_scopes, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um escopo';
  END IF;

  -- 32 bytes aleatórios em hex (64 chars) + prefixo bw_
  v_raw    := encode(extensions.gen_random_bytes(32), 'hex');
  v_token  := 'bw_' || v_raw;
  v_hash   := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_prefix := substring(v_token from 1 for 10);

  INSERT INTO public.personal_access_tokens
    (user_id, name, token_hash, token_prefix, scopes, expires_at, created_by)
  VALUES
    (v_uid, trim(p_name), v_hash, v_prefix, p_scopes, p_expires_at, v_uid)
  RETURNING personal_access_tokens.id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_access_token(text, text[], timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_personal_access_token(text, text[], timestamptz) TO authenticated;

-- ── RPC: revogar token ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_personal_access_token(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem revogar tokens';
  END IF;

  UPDATE public.personal_access_tokens
     SET revoked_at = now()
   WHERE id = p_id
     AND revoked_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_personal_access_token(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revoke_personal_access_token(uuid) TO authenticated;

-- Garantir extensão pgcrypto p/ digest/gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;