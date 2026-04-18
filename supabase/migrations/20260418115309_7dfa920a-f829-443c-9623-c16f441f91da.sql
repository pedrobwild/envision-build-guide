CREATE OR REPLACE FUNCTION public.calc_lead_time_from_events(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(avg_days numeric, median_days numeric, sample_size integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sent_events AS (
    SELECT DISTINCT ON (e.budget_id)
      e.budget_id,
      e.created_at AS sent_at,
      b.created_at AS budget_created_at
    FROM public.budget_events e
    JOIN public.budgets b ON b.id = e.budget_id
    WHERE e.event_type = 'status_change'
      AND e.to_status = 'sent_to_client'
      AND e.created_at BETWEEN p_from AND p_to
      AND b.created_at >= '2026-04-15'::timestamptz
    ORDER BY e.budget_id, e.created_at ASC
  ),
  durations AS (
    -- CEILING: 0-24h => 1 dia, 25-48h => 2 dias, etc.
    SELECT CEIL(EXTRACT(EPOCH FROM (sent_at - budget_created_at)) / 86400.0)::numeric AS days
    FROM sent_events
    WHERE sent_at > budget_created_at
  )
  SELECT
    ROUND(AVG(days)::numeric, 2),
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days)::numeric, 2),
    COUNT(*)::INTEGER
  FROM durations;
$function$;