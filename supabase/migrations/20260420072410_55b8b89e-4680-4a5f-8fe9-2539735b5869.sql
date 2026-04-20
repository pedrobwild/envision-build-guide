
-- Cleanup de órfãos (idempotente)
DELETE FROM public.budget_events
 WHERE NOT EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_events.budget_id);

DELETE FROM public.budget_comments
 WHERE NOT EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_comments.budget_id);

-- FKs faltantes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_events_budget_id_fkey') THEN
    ALTER TABLE public.budget_events
      ADD CONSTRAINT budget_events_budget_id_fkey
      FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_comments_budget_id_fkey') THEN
    ALTER TABLE public.budget_comments
      ADD CONSTRAINT budget_comments_budget_id_fkey
      FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices de FK
CREATE INDEX IF NOT EXISTS idx_budgets_client_id ON public.budgets(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_property_id ON public.budgets(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_pipeline_id ON public.budgets(pipeline_id) WHERE pipeline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_properties_client_id ON public.client_properties(client_id);
CREATE INDEX IF NOT EXISTS idx_budget_events_budget_id ON public.budget_events(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_comments_budget_id ON public.budget_comments(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_meetings_budget_id ON public.budget_meetings(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lost_reasons_budget_id ON public.budget_lost_reasons(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_optional_selections_budget_id ON public.budget_optional_selections(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_tours_budget_id ON public.budget_tours(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_activities_budget_id ON public.budget_activities(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_conversations_budget_id ON public.budget_conversations(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_conversation_messages_conversation_id ON public.budget_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_budget_id ON public.adjustments(budget_id);

-- Dedup de policies RLS
DROP POLICY IF EXISTS "Authenticated users can manage their budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users manage adjustments via budget ownership" ON public.adjustments;
DROP POLICY IF EXISTS "Users manage optional selections via budget ownership" ON public.budget_optional_selections;
DROP POLICY IF EXISTS "Users manage tours via budget ownership" ON public.budget_tours;

-- Policy unificada para criador
DROP POLICY IF EXISTS "Creator can manage own budget" ON public.budgets;
CREATE POLICY "Creator can manage own budget"
  ON public.budgets
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
