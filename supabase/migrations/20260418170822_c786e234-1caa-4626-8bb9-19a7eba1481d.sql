-- ============================================================
-- 1. Add new columns to budgets
-- ============================================================
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS win_probability integer CHECK (win_probability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS expected_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_source text;

-- ============================================================
-- 2. budget_activities
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call','meeting','visit','email','task','note','stage_change','other')),
  title text NOT NULL,
  description text,
  owner_id uuid,
  scheduled_for timestamptz,
  completed_at timestamptz,
  outcome text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_activities_budget_scheduled
  ON public.budget_activities (budget_id, scheduled_for DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_budget_activities_owner
  ON public.budget_activities (owner_id);

ALTER TABLE public.budget_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all activities" ON public.budget_activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view activities of accessible budgets" ON public.budget_activities
  FOR SELECT TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users insert activities on accessible budgets" ON public.budget_activities
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users update activities on accessible budgets" ON public.budget_activities
  FOR UPDATE TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id))
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users delete own activities" ON public.budget_activities
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_budget_activities_updated_at
  BEFORE UPDATE ON public.budget_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. budget_meetings (Elephan.ia)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'elephan_ia',
  external_id text,
  title text,
  started_at timestamptz,
  duration_seconds integer,
  audio_url text,
  transcript text,
  summary text,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS budget_meetings_provider_ext_uidx
  ON public.budget_meetings (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_meetings_budget
  ON public.budget_meetings (budget_id, started_at DESC NULLS LAST);

ALTER TABLE public.budget_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all meetings" ON public.budget_meetings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view meetings of accessible budgets" ON public.budget_meetings
  FOR SELECT TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users insert meetings on accessible budgets" ON public.budget_meetings
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users update meetings on accessible budgets" ON public.budget_meetings
  FOR UPDATE TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id))
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Service role manages meetings" ON public.budget_meetings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_budget_meetings_updated_at
  BEFORE UPDATE ON public.budget_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. budget_conversations (Digisac)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'digisac',
  external_id text,
  channel text,
  contact_name text,
  contact_identifier text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS budget_conversations_provider_ext_uidx
  ON public.budget_conversations (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_conversations_budget
  ON public.budget_conversations (budget_id, last_message_at DESC NULLS LAST);

ALTER TABLE public.budget_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all conversations" ON public.budget_conversations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view conversations of accessible budgets" ON public.budget_conversations
  FOR SELECT TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users insert conversations on accessible budgets" ON public.budget_conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users update conversations on accessible budgets" ON public.budget_conversations
  FOR UPDATE TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id))
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Service role manages conversations" ON public.budget_conversations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER touch_budget_conversations_updated_at
  BEFORE UPDATE ON public.budget_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. budget_conversation_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.budget_conversations(id) ON DELETE CASCADE,
  external_id text,
  direction text CHECK (direction IN ('in','out')),
  author_name text,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_conv_msgs_conv_sent
  ON public.budget_conversation_messages (conversation_id, sent_at DESC NULLS LAST);

ALTER TABLE public.budget_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all conv messages" ON public.budget_conversation_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view conv messages of accessible budgets" ON public.budget_conversation_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.budget_conversations c
    WHERE c.id = conversation_id
      AND public.can_access_budget(auth.uid(), c.budget_id)
  ));

CREATE POLICY "Users insert conv messages on accessible budgets" ON public.budget_conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.budget_conversations c
    WHERE c.id = conversation_id
      AND public.can_access_budget(auth.uid(), c.budget_id)
  ));

CREATE POLICY "Service role manages conv messages" ON public.budget_conversation_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 6. budget_lost_reasons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.budget_lost_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL UNIQUE REFERENCES public.budgets(id) ON DELETE CASCADE,
  reason_category text NOT NULL CHECK (reason_category IN ('preco','escopo','concorrente','timing','sem_retorno','desistencia','outro')),
  reason_detail text,
  competitor_name text,
  competitor_value numeric,
  lost_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.budget_lost_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all lost reasons" ON public.budget_lost_reasons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view lost reasons of accessible budgets" ON public.budget_lost_reasons
  FOR SELECT TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users insert lost reasons on accessible budgets" ON public.budget_lost_reasons
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users update lost reasons on accessible budgets" ON public.budget_lost_reasons
  FOR UPDATE TO authenticated
  USING (public.can_access_budget(auth.uid(), budget_id))
  WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

-- ============================================================
-- 7. Helper: derive pipeline_stage from internal_status
-- ============================================================
CREATE OR REPLACE FUNCTION public.derive_pipeline_stage(_internal_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _internal_status
    WHEN 'mql' THEN 'lead'
    WHEN 'lead' THEN 'lead'
    WHEN 'novo' THEN 'lead'
    WHEN 'requested' THEN 'lead'
    WHEN 'qualificacao' THEN 'lead'
    WHEN 'triage' THEN 'briefing'
    WHEN 'assigned' THEN 'briefing'
    WHEN 'validacao_briefing' THEN 'briefing'
    WHEN 'em_analise' THEN 'briefing'
    WHEN 'in_progress' THEN 'visita'
    WHEN 'waiting_info' THEN 'visita'
    WHEN 'aguardando_info' THEN 'visita'
    WHEN 'ready_for_review' THEN 'proposta'
    WHEN 'em_revisao' THEN 'proposta'
    WHEN 'revision_requested' THEN 'proposta'
    WHEN 'delivered_to_sales' THEN 'proposta'
    WHEN 'sent_to_client' THEN 'proposta'
    WHEN 'published' THEN 'proposta'
    WHEN 'minuta_solicitada' THEN 'negociacao'
    WHEN 'contrato_fechado' THEN 'fechado'
    WHEN 'lost' THEN 'perdido'
    WHEN 'perdido' THEN 'perdido'
    WHEN 'archived' THEN 'perdido'
    ELSE 'lead'
  END;
$$;

CREATE OR REPLACE FUNCTION public.default_win_probability(_stage text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _stage
    WHEN 'lead' THEN 10
    WHEN 'briefing' THEN 25
    WHEN 'visita' THEN 40
    WHEN 'proposta' THEN 55
    WHEN 'negociacao' THEN 70
    WHEN 'fechado' THEN 100
    WHEN 'perdido' THEN 0
    ELSE 10
  END;
$$;

-- ============================================================
-- 8. Backfill existing budgets
-- ============================================================
UPDATE public.budgets
SET
  pipeline_stage = COALESCE(pipeline_stage, public.derive_pipeline_stage(internal_status)),
  win_probability = COALESCE(win_probability, public.default_win_probability(public.derive_pipeline_stage(internal_status))),
  expected_close_at = COALESCE(expected_close_at, due_at, created_at + INTERVAL '21 days'),
  lead_source = COALESCE(lead_source, external_source, 'não informado')
WHERE pipeline_stage IS NULL
   OR win_probability IS NULL
   OR expected_close_at IS NULL
   OR lead_source IS NULL;

-- ============================================================
-- 9. Trigger: keep pipeline_stage + win_probability in sync when internal_status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_pipeline_stage_from_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_stage text;
BEGIN
  IF NEW.internal_status IS DISTINCT FROM OLD.internal_status THEN
    _new_stage := public.derive_pipeline_stage(NEW.internal_status);
    NEW.pipeline_stage := _new_stage;
    -- Only auto-update probability if user did not set it manually in this update
    IF NEW.win_probability IS NULL OR NEW.win_probability = OLD.win_probability THEN
      NEW.win_probability := public.default_win_probability(_new_stage);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_pipeline_stage_trg ON public.budgets;
CREATE TRIGGER sync_pipeline_stage_trg
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_pipeline_stage_from_status();