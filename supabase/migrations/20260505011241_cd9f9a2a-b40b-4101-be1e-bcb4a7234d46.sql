-- 1. Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  budget_id uuid NULL,
  public_id text NULL,
  actor_user_id uuid NULL,
  actor_role text NULL,
  ip_address text NULL,
  user_agent text NULL,
  referrer text NULL,
  route text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_access_audit_log_budget_id ON public.access_audit_log(budget_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_public_id ON public.access_audit_log(public_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_event_type ON public.access_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_created_at ON public.access_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_audit_log_actor ON public.access_audit_log(actor_user_id);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins leem
CREATE POLICY "Admins can read access audit log"
  ON public.access_audit_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Comercial/orcamentista podem ler eventos dos seus orçamentos
CREATE POLICY "Owners can read audit of own budgets"
  ON public.access_audit_log
  FOR SELECT
  TO authenticated
  USING (
    budget_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM budgets b
      WHERE b.id = access_audit_log.budget_id
        AND (b.commercial_owner_id = auth.uid() OR b.estimator_owner_id = auth.uid())
    )
  );

-- Service role faz qualquer coisa
CREATE POLICY "Service role manages audit log"
  ON public.access_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. RPC pública para registrar visualização de orçamento
-- Permite anon/auth gravar UM evento por chamada, validando que public_id existe.
CREATE OR REPLACE FUNCTION public.log_public_budget_access(
  p_public_id text,
  p_event_type text DEFAULT 'public_budget_view',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_referrer text DEFAULT NULL,
  p_route text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget_id uuid;
  v_id uuid;
  v_ua text;
  v_ip text;
  v_event text;
BEGIN
  -- Whitelist de event_types aceitos via cliente
  v_event := COALESCE(p_event_type, 'public_budget_view');
  IF v_event NOT IN (
    'public_budget_view',
    'public_budget_pdf_export',
    'public_optional_selection',
    'public_contract_request_started',
    'public_contract_request_submitted',
    'public_link_invalid'
  ) THEN
    RAISE EXCEPTION 'invalid event_type';
  END IF;

  IF p_public_id IS NULL OR length(p_public_id) = 0 OR length(p_public_id) > 64 THEN
    RAISE EXCEPTION 'invalid public_id';
  END IF;

  SELECT id INTO v_budget_id
  FROM budgets
  WHERE public_id = p_public_id
  LIMIT 1;

  -- captura IP/UA quando vierem nos headers (PostgREST popula request.headers)
  BEGIN
    v_ua := current_setting('request.headers', true)::jsonb ->> 'user-agent';
    v_ip := current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for';
  EXCEPTION WHEN OTHERS THEN
    v_ua := NULL;
    v_ip := NULL;
  END;

  INSERT INTO public.access_audit_log (
    event_type, budget_id, public_id,
    actor_user_id, ip_address, user_agent,
    referrer, route, metadata
  ) VALUES (
    v_event, v_budget_id, p_public_id,
    auth.uid(), v_ip, v_ua,
    p_referrer, p_route,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_public_budget_access(text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_public_budget_access(text, text, jsonb, text, text) TO anon, authenticated;