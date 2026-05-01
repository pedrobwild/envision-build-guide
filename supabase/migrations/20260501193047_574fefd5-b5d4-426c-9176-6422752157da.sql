
-- 1. Coluna active_role em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role public.app_role NULL;

-- 2. set_active_role: valida que o usuário tem o papel antes de persistir
CREATE OR REPLACE FUNCTION public.set_active_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = _role
  ) THEN
    RAISE EXCEPTION 'user does not have role %', _role;
  END IF;

  UPDATE public.profiles
     SET active_role = _role
   WHERE id = v_uid;
END;
$$;

-- 3. clear_active_role: volta ao papel primário
CREATE OR REPLACE FUNCTION public.clear_active_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  UPDATE public.profiles SET active_role = NULL WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_role(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_active_role() TO authenticated;
