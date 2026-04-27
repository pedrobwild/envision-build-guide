
-- =====================================================================
-- HARDENING DE SEGURANÇA: bucket listing + EXECUTE em SECURITY DEFINER
-- =====================================================================
-- Resolve warnings do Supabase linter:
--   • 0025 public_bucket_allows_listing  (4 ocorrências)
--   • 0028 anon_security_definer_function_executable  (~30 ocorrências)
-- Mantém intactas as 3 RPCs públicas usadas pelo orçamento (get_public_budget,
-- increment_view_count, approve_addendum) e a leitura pública por URL direta
-- nos buckets (bucket.public=true continua valendo via CDN).
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1) Storage: substituir SELECT broad para `authenticated` por
--    versões path-scoped que NÃO permitem listing genérico do bucket.
--    A leitura pública anônima de arquivos via URL continua funcionando
--    porque os buckets seguem com `public = true` (CDN bypass de policy).
-- ─────────────────────────────────────────────────────────────────────

-- 1.1 BUDGET-PDFS — só usuários com permissão sobre o orçamento listam
DROP POLICY IF EXISTS "Authenticated can list budget PDFs" ON storage.objects;
CREATE POLICY "Staff can list their budget PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'budget-pdfs'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'orcamentista'::public.app_role)
      OR public.has_role(auth.uid(), 'comercial'::public.app_role)
    )
  );

-- 1.2 BUDGET-ASSETS — apenas staff envolvido no orçamento (mesmo escopo do upload)
DROP POLICY IF EXISTS "Authenticated can list budget assets" ON storage.objects;
CREATE POLICY "Staff can list their budget assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'budget-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'orcamentista'::public.app_role)
      OR public.has_role(auth.uid(), 'comercial'::public.app_role)
    )
  );

-- 1.3 MEDIA — apenas staff (uploads/edição). Leitura pública continua via CDN.
DROP POLICY IF EXISTS "Authenticated can list media" ON storage.objects;
CREATE POLICY "Staff can list media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'orcamentista'::public.app_role)
      OR public.has_role(auth.uid(), 'comercial'::public.app_role)
    )
  );

-- 1.4 CLIENT-ASSETS — havia "Public can read client-assets" para todos os roles.
-- Substituí por leitura autenticada por staff. URL pública continua via CDN.
DROP POLICY IF EXISTS "Public can read client-assets" ON storage.objects;
CREATE POLICY "Staff can list client assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-assets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'orcamentista'::public.app_role)
      OR public.has_role(auth.uid(), 'comercial'::public.app_role)
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 2) SECURITY DEFINER: revogar EXECUTE de anon em todas as funções,
--    EXCETO as 3 RPCs do orçamento público.
--    Trigger functions ficam apenas com EXECUTE para postgres/service_role
--    (não impacta — triggers rodam pelo dono).
--    RPCs administrativas mantêm EXECUTE em authenticated (já têm
--    has_role(...) interno).
-- ─────────────────────────────────────────────────────────────────────

-- 2.1 RPCs administrativas / utilitárias (revogar anon, garantir authenticated)
REVOKE EXECUTE ON FUNCTION public.archive_old_lead_payloads() FROM anon;
REVOKE EXECUTE ON FUNCTION public.budget_days_in_stage(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bulk_apply_factor_to_items(uuid[], numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calc_lead_time_from_events(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calc_time_in_stage(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_budget(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_and_create_alerts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_digisac_webhook_events() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_snapshots() FROM anon;
REVOKE EXECUTE ON FUNCTION public.compare_snapshots(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_eligible_budgets(text[], text[], date, date, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_budget_totals() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_summary() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_failed_lead_sources(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_budget_as_manual_baseline(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reorder_catalog_categories(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_lead_owner(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_reengagement_sweep() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_primary_supplier_price(uuid, uuid) FROM anon;

-- 2.2 Trigger functions: revogar de anon E de authenticated (nunca devem
-- ser invocadas por PostgREST; só rodam via gatilhos como SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.create_mql_budget_for_new_client() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_budget_sequential_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_catalog_item_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_client_sequential_code() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_internal_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_supplier_price_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_owner_on_new_lead() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_budget_requested_notify() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_client_property_from_budget() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_client_status_from_budget() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_pipeline_stage_from_status() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_pipeline_stage_on_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_bug_reports_audit_critical() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_clients_set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_status_change_insert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_sync_project_on_contrato() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_sync_supplier_outbound() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_internal_status_transition() FROM anon, authenticated, PUBLIC;

-- 2.3 Garantir que as 3 RPCs do orçamento público continuam abertas a anon
GRANT EXECUTE ON FUNCTION public.get_public_budget(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_addendum(text, text) TO anon, authenticated;
