-- Belt-and-suspenders: explicitly deny anon (in case PUBLIC inherits transitively)
REVOKE EXECUTE ON FUNCTION public.get_team_members(public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_team_members(public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_team_members(public.app_role) TO authenticated;
