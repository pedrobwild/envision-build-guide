-- Tabela auxiliar para "devolver" o ID reutilizado para o caller
CREATE TABLE IF NOT EXISTS public.budget_reuse_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid,
  property_id uuid,
  reused_budget_id uuid NOT NULL,
  attempted_by uuid,
  source text,
  attempted_payload jsonb
);
ALTER TABLE public.budget_reuse_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reuse log"
  ON public.budget_reuse_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages reuse log"
  ON public.budget_reuse_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Trigger function: redireciona silenciosamente INSERT duplicado
CREATE OR REPLACE FUNCTION public.redirect_duplicate_budget_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
  _terminal text[] := ARRAY['contrato_fechado','perdido','lost','archived'];
BEGIN
  -- Pula casos especiais que devem sempre criar novo
  IF NEW.client_id IS NULL
     OR NEW.is_addendum = true
     OR NEW.parent_budget_id IS NOT NULL
     OR COALESCE(NEW.header_config->>'force_new', 'false') = 'true'
     OR COALESCE(NEW.is_current_version, true) = false
     OR (NEW.internal_status = ANY(_terminal)) THEN
    RETURN NEW;
  END IF;

  -- Procura orçamento ativo existente do mesmo cliente + mesmo imóvel
  SELECT b.id INTO _existing_id
    FROM public.budgets b
   WHERE b.client_id = NEW.client_id
     AND COALESCE(b.is_current_version, true) = true
     AND NOT (b.internal_status = ANY(_terminal))
     AND (
       (NEW.property_id IS NOT NULL AND b.property_id = NEW.property_id)
       OR (NEW.property_id IS NULL AND b.property_id IS NULL)
     )
   ORDER BY (b.pipeline_id IS NOT NULL) DESC, b.updated_at DESC
   LIMIT 1;

  IF _existing_id IS NULL THEN
    RETURN NEW; -- sem duplicado, prossegue INSERT normal
  END IF;

  -- Loga a tentativa
  INSERT INTO public.budget_reuse_log (
    client_id, property_id, reused_budget_id, attempted_by, source, attempted_payload
  ) VALUES (
    NEW.client_id, NEW.property_id, _existing_id, auth.uid(),
    COALESCE(NEW.external_source, NEW.lead_source, 'manual'),
    jsonb_build_object(
      'project_name', NEW.project_name,
      'client_name',  NEW.client_name,
      'internal_status', NEW.internal_status,
      'pipeline_stage', NEW.pipeline_stage
    )
  );

  -- Registra evento no orçamento reutilizado
  INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
  VALUES (
    _existing_id,
    'budget_reused',
    'Tentativa de criar orçamento duplicado redirecionada para este registro',
    jsonb_build_object(
      'client_id', NEW.client_id,
      'property_id', NEW.property_id,
      'attempted_source', COALESCE(NEW.external_source, NEW.lead_source, 'manual')
    ),
    now()
  );

  -- Toca updated_at do existente para sinalizar atividade
  UPDATE public.budgets SET updated_at = now() WHERE id = _existing_id;

  -- Cancela o INSERT silenciosamente
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS budgets_redirect_duplicate_insert ON public.budgets;
CREATE TRIGGER budgets_redirect_duplicate_insert
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.redirect_duplicate_budget_insert();

-- Função auxiliar: front-end pode chamar para descobrir o ID resultante
CREATE OR REPLACE FUNCTION public.get_or_reuse_budget_for_client(
  _client_id uuid,
  _property_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resolve_active_budget_for_lead(_client_id, _property_id);
$$;

CREATE INDEX IF NOT EXISTS idx_budget_reuse_log_client
  ON public.budget_reuse_log(client_id, attempted_at DESC);