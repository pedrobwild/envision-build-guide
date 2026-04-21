CREATE OR REPLACE FUNCTION public.get_public_budget(p_public_id text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(t) FROM (
    SELECT
      b.id, b.project_name, b.client_name, b.condominio,
      COALESCE(NULLIF(p.bairro, ''), b.bairro) AS bairro,
      COALESCE(NULLIF(p.metragem, ''), b.metragem) AS metragem,
      b.unit, b.date, b.validity_days, b.prazo_dias_uteis, b.estimated_weeks,
      b.versao, b.version_number, b.consultora_comercial, b.email_comercial,
      b.status, b.public_id, b.show_item_qty, b.show_item_prices, b.show_progress_bars,
      b.show_optional_items, b.generated_at, b.disclaimer, b.notes,
      COALESCE(p.floor_plan_url, b.floor_plan_url) AS floor_plan_url,
      b.view_count, b.approved_at, b.approved_by_name, b.lead_email, b.lead_name,
      b.header_config, b.budget_pdf_url, b.manual_total
    FROM budgets b
    LEFT JOIN client_properties p ON p.id = b.property_id
    WHERE b.public_id = p_public_id
      AND b.status IN ('published', 'minuta_solicitada')
      AND b.public_id IS NOT NULL
    LIMIT 1
  ) t
$function$;