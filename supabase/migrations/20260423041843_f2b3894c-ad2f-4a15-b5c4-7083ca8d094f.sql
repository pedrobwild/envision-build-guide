-- Tabela de auditoria para migrações de mídia padrão
CREATE TABLE IF NOT EXISTS public.media_migration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  budget_id uuid,
  budget_label text,
  action text NOT NULL CHECK (action IN ('updated', 'skipped')),
  reason text,
  source_budget_id uuid,
  media_before jsonb,
  media_after jsonb,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_migration_audit_batch
  ON public.media_migration_audit(batch_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_migration_audit_budget
  ON public.media_migration_audit(budget_id);

ALTER TABLE public.media_migration_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media migration audit"
  ON public.media_migration_audit
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages media migration audit"
  ON public.media_migration_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);