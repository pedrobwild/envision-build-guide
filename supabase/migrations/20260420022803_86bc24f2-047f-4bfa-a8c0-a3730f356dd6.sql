-- ===== Onda 1: deal_pipelines + days_in_stage helper =====

-- 1. Tabela de pipelines (Inbound, Indicação, Re-engajamento, etc.)
CREATE TABLE IF NOT EXISTS public.deal_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pipelines"
  ON public.deal_pipelines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage pipelines"
  ON public.deal_pipelines FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_deal_pipelines_updated
  BEFORE UPDATE ON public.deal_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds: 3 pipelines iniciais
INSERT INTO public.deal_pipelines (slug, name, description, color, order_index, is_default)
VALUES
  ('inbound',       'Inbound',       'Leads que chegaram via formulários, anúncios e canais digitais', '#3b82f6', 1, true),
  ('indicacao',     'Indicação',     'Leads vindos de indicações de clientes, arquitetos e parceiros', '#10b981', 2, false),
  ('reengajamento', 'Re-engajamento','Negócios perdidos ou frios que estão sendo retrabalhados',       '#f59e0b', 3, false)
ON CONFLICT (slug) DO NOTHING;

-- 2. Vincular budgets a um pipeline (opcional; null = pipeline default)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.deal_pipelines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_pipeline_id ON public.budgets(pipeline_id);

-- Backfill: aponta tudo para Inbound (default)
UPDATE public.budgets
SET pipeline_id = (SELECT id FROM public.deal_pipelines WHERE slug = 'inbound' LIMIT 1)
WHERE pipeline_id IS NULL;

-- 3. Função: dias parado na etapa atual (a partir de budget_events)
CREATE OR REPLACE FUNCTION public.budget_days_in_stage(p_budget_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_change AS (
    SELECT created_at
    FROM public.budget_events
    WHERE budget_id = p_budget_id
      AND event_type = 'status_change'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  fallback AS (
    SELECT created_at FROM public.budgets WHERE id = p_budget_id
  )
  SELECT GREATEST(
    0,
    EXTRACT(DAY FROM (now() - COALESCE(
      (SELECT created_at FROM last_change),
      (SELECT created_at FROM fallback)
    )))::integer
  );
$$;

-- 4. View prática: budgets com days_in_stage e pipeline_slug embutidos
--    Usada pelo Kanban e badges de "rot".
CREATE OR REPLACE VIEW public.budget_pipeline_view
WITH (security_invoker = true)
AS
WITH last_status_change AS (
  SELECT DISTINCT ON (budget_id)
    budget_id,
    created_at AS last_status_change_at
  FROM public.budget_events
  WHERE event_type = 'status_change'
  ORDER BY budget_id, created_at DESC
)
SELECT
  b.id,
  b.pipeline_id,
  p.slug AS pipeline_slug,
  p.name AS pipeline_name,
  COALESCE(lsc.last_status_change_at, b.created_at) AS stage_entered_at,
  GREATEST(0, EXTRACT(DAY FROM (now() - COALESCE(lsc.last_status_change_at, b.created_at)))::integer) AS days_in_stage
FROM public.budgets b
LEFT JOIN public.deal_pipelines p ON p.id = b.pipeline_id
LEFT JOIN last_status_change lsc ON lsc.budget_id = b.id;

GRANT SELECT ON public.budget_pipeline_view TO authenticated;