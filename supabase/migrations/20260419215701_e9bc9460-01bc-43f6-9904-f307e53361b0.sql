-- Saved views for CRM (per user, per entity)
CREATE TABLE public.user_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('budgets','clients')),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_saved_views_user_entity ON public.user_saved_views(user_id, entity);
CREATE INDEX idx_user_saved_views_shared ON public.user_saved_views(entity) WHERE is_shared = true;

ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;

-- Users see their own + shared views
CREATE POLICY "Users view own and shared saved views"
ON public.user_saved_views FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_shared = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own saved views"
ON public.user_saved_views FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own saved views"
ON public.user_saved_views FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own saved views"
ON public.user_saved_views FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER trg_user_saved_views_updated_at
BEFORE UPDATE ON public.user_saved_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default per (user, entity)
CREATE UNIQUE INDEX uniq_default_view_per_user_entity
ON public.user_saved_views(user_id, entity)
WHERE is_default = true;