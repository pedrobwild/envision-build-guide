CREATE OR REPLACE VIEW public.monitor_meta_ingestion_health AS
SELECT 
  date_trunc('hour', c.created_at) AS hora,
  c.source,
  c.utm_medium,
  COUNT(*) AS leads,
  COUNT(CASE WHEN c.ad_id IS NOT NULL THEN 1 END) AS com_ad_id,
  COUNT(CASE WHEN c.campaign_id IS NOT NULL THEN 1 END) AS com_campaign,
  COUNT(CASE WHEN c.email IS NOT NULL THEN 1 END) AS com_email,
  COUNT(CASE WHEN c.phone_normalized IS NOT NULL THEN 1 END) AS com_phone,
  COUNT(CASE WHEN b.id IS NULL THEN 1 END) AS sem_budget,
  COUNT(CASE WHEN b.pipeline_id IS NULL THEN 1 END) AS sem_pipeline,
  ROUND(100.0 * COUNT(CASE WHEN c.ad_id IS NOT NULL THEN 1 END) 
        / NULLIF(COUNT(*), 0), 1) AS pct_atribuido
FROM clients c
LEFT JOIN budgets b ON b.client_id = c.id
WHERE c.email NOT LIKE '%@test.bwild.com.br'
  AND c.created_at > now() - interval '7 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC;