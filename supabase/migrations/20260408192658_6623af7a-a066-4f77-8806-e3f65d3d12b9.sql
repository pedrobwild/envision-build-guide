
CREATE OR REPLACE FUNCTION public.get_public_budget(p_public_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(t) FROM (
    SELECT
      id, project_name, client_name, condominio, bairro, metragem, unit,
      date, validity_days, prazo_dias_uteis, estimated_weeks,
      versao, version_number, consultora_comercial, email_comercial,
      status, public_id, show_item_qty, show_item_prices, show_progress_bars,
      show_optional_items, generated_at, disclaimer, notes, floor_plan_url,
      view_count, approved_at, approved_by_name, lead_email, lead_name,
      header_config, budget_pdf_url, manual_total
    FROM budgets
    WHERE public_id = p_public_id
      AND status IN ('published', 'minuta_solicitada')
      AND public_id IS NOT NULL
    LIMIT 1
  ) t
$function$;
