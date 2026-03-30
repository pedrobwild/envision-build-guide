
-- 1. Fix notifications INSERT policy: restrict to service_role only
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 2. Create atomic view_count increment RPC
CREATE OR REPLACE FUNCTION public.increment_view_count(p_public_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE budgets
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE public_id = p_public_id
    AND status IN ('published', 'minuta_solicitada');
$$;
