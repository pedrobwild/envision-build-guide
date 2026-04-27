
-- Privilégio EXECUTE estava herdado de PUBLIC (default do Postgres).
-- Revogamos de PUBLIC e re-concedemos só para authenticated, exceto as
-- 3 RPCs do orçamento público que precisam continuar abertas a anon.

REVOKE EXECUTE ON FUNCTION public.archive_old_lead_payloads() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.archive_old_lead_payloads() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.budget_days_in_stage(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.budget_days_in_stage(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.bulk_apply_factor_to_items(uuid[], numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.bulk_apply_factor_to_items(uuid[], numeric) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calc_lead_time_from_events(timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calc_lead_time_from_events(timestamptz, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.calc_time_in_stage(timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calc_time_in_stage(timestamptz, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_budget(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_access_budget(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_and_create_alerts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_create_alerts() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_digisac_webhook_events() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_old_digisac_webhook_events() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_snapshots() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_old_snapshots() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.compare_snapshots(date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compare_snapshots(date, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.count_eligible_budgets(text[], text[], date, date, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.count_eligible_budgets(text[], text[], date, date, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_budget_totals() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_budget_totals() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_summary() TO authenticated;

-- has_role é usado dentro de policies — manter acessível mas tirar de anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_failed_lead_sources(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.list_failed_lead_sources(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_budget_as_manual_baseline(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_budget_as_manual_baseline(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reorder_catalog_categories(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reorder_catalog_categories(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_lead_owner(text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_lead_owner(text, text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.run_reengagement_sweep() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.run_reengagement_sweep() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_primary_supplier_price(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_primary_supplier_price(uuid, uuid) TO authenticated;
