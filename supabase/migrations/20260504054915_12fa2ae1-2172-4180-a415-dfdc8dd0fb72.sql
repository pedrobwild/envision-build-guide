-- Audit RPC: lists EXECUTE privileges on key analytics/budget RPCs (admin-only)
CREATE OR REPLACE FUNCTION public.audit_rpc_grants()
RETURNS TABLE(
  function_name text,
  function_schema text,
  security_type text,
  return_type text,
  grantee text,
  privilege_type text,
  is_grantable boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin required)';
  END IF;

  RETURN QUERY
  SELECT
    p.proname::text                                        AS function_name,
    n.nspname::text                                        AS function_schema,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_type,
    pg_catalog.pg_get_function_result(p.oid)::text         AS return_type,
    COALESCE(rp.rolname, 'PUBLIC')::text                   AS grantee,
    acl.privilege_type::text                               AS privilege_type,
    acl.is_grantable
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl ON TRUE
  LEFT JOIN pg_roles rp ON rp.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'sales_kpis_dashboard',
      'sales_kpis_cohorts',
      'sales_kpis_by_owner',
      'sales_kpis_time_in_stage',
      'sales_kpis_lost_reasons',
      'sales_conversion_by_segment',
      'get_public_budget_total',
      'get_public_budget',
      'get_budget_time_markers',
      'count_eligible_budgets',
      'bulk_apply_factor_to_items',
      'list_deleted_budgets',
      'restore_budget',
      'purge_budget',
      'resolve_published_public_id',
      'merge_duplicate_properties'
    )
    AND acl.privilege_type = 'EXECUTE'
  ORDER BY p.proname, grantee;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_rpc_grants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_rpc_grants() TO authenticated;