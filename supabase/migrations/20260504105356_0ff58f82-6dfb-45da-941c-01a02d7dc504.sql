-- 1) RPC SECURITY DEFINER: lista membros (somente metadados necessários para UI)
CREATE OR REPLACE FUNCTION public.get_team_members(_role public.app_role DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  full_name text,
  role public.app_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (ur.user_id)
    ur.user_id AS id,
    COALESCE(p.full_name, '(sem nome)') AS full_name,
    ur.role
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE p.is_active = true
    AND (_role IS NULL OR ur.role = _role)
  ORDER BY ur.user_id, ur.role;
$$;

-- Permitir execução por qualquer usuário autenticado (admins, comerciais, orçamentistas)
REVOKE ALL ON FUNCTION public.get_team_members(public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.get_team_members(public.app_role) TO authenticated;

-- 2) Remover a política ampla que permitia qualquer autenticado ler user_roles
DROP POLICY IF EXISTS "Authenticated users can read all roles" ON public.user_roles;

-- (mantidas) "Admins can read all roles", "Users can read own roles", "Admins can manage roles"
