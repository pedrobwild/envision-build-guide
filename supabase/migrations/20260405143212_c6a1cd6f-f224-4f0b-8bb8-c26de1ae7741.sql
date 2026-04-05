
-- Tabela de controle de sincronização entre sistemas
CREATE TABLE public.integration_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_id UUID,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  error_message TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(source_system, entity_type, source_id)
);

-- Enable RLS
ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins and service_role can manage sync logs
CREATE POLICY "Admins can manage sync logs"
  ON public.integration_sync_log FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage sync logs"
  ON public.integration_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add external_id column to suppliers for cross-system linking
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS external_id UUID;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS external_system TEXT;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sync_log_source ON public.integration_sync_log(source_system, entity_type, source_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON public.integration_sync_log(sync_status);
CREATE INDEX IF NOT EXISTS idx_suppliers_external ON public.suppliers(external_id) WHERE external_id IS NOT NULL;
