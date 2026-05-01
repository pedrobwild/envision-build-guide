-- Allow anonymous (public) role to evaluate has_role() during RLS checks.
-- Without this grant, Postgres aborts SELECTs on tables whose policy list
-- references has_role() (e.g. items, sections), even if a different
-- "Public can view ..." policy would have permitted the row.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;