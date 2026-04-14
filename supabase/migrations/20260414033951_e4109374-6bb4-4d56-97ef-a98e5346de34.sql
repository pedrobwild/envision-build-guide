
-- Add media_config to budget_templates
ALTER TABLE public.budget_templates
ADD COLUMN IF NOT EXISTS media_config jsonb DEFAULT '{}'::jsonb;

-- Add media_config to budgets
ALTER TABLE public.budgets
ADD COLUMN IF NOT EXISTS media_config jsonb DEFAULT NULL;

COMMENT ON COLUMN public.budget_templates.media_config IS 'JSON with keys: video3d (string URL), projeto3d (string[] URLs), projetoExecutivo (string[] URLs), fotos (string[] URLs)';
COMMENT ON COLUMN public.budgets.media_config IS 'Copied from template media_config on budget creation. Overrides storage-folder-based media when present.';
