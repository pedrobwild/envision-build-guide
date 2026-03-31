
-- 1. Budget events (timeline/log)
CREATE TABLE public.budget_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  user_id uuid,
  event_type text NOT NULL DEFAULT 'status_change',
  from_status text,
  to_status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_events ENABLE ROW LEVEL SECURITY;

-- 2. Budget comments (internal notes between teams)
CREATE TABLE public.budget_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_comments ENABLE ROW LEVEL SECURITY;

-- 3. RLS for budget_events: authenticated users who can access the budget
CREATE POLICY "Users can view events of accessible budgets"
ON public.budget_events FOR SELECT TO authenticated
USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users can insert events on accessible budgets"
ON public.budget_events FOR INSERT TO authenticated
WITH CHECK (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Admins can manage all events"
ON public.budget_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. RLS for budget_comments
CREATE POLICY "Users can view comments of accessible budgets"
ON public.budget_comments FOR SELECT TO authenticated
USING (public.can_access_budget(auth.uid(), budget_id));

CREATE POLICY "Users can insert comments on accessible budgets"
ON public.budget_comments FOR INSERT TO authenticated
WITH CHECK (public.can_access_budget(auth.uid(), budget_id) AND user_id = auth.uid());

CREATE POLICY "Users can update own comments"
ON public.budget_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all comments"
ON public.budget_comments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
