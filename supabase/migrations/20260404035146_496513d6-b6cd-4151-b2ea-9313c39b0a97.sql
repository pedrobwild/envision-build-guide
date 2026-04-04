
-- Fix 1: Restrict INSERT on budget-assets to only allow uploads into owned budget folders
DROP POLICY IF EXISTS "Authenticated users can upload budget assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload budget assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'budget-assets'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.budgets
      WHERE created_by = auth.uid()
         OR estimator_owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Fix 2: Replace broad anon SELECT on budgets with a security-definer function
-- that returns only public-safe columns
CREATE OR REPLACE FUNCTION public.get_public_budget(p_public_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t) FROM (
    SELECT
      id, project_name, client_name, condominio, bairro, metragem, unit,
      date, validity_days, prazo_dias_uteis, estimated_weeks,
      versao, version_number, consultora_comercial, email_comercial,
      status, public_id, show_item_qty, show_item_prices, show_progress_bars,
      show_optional_items, generated_at, disclaimer, notes, floor_plan_url,
      view_count, approved_at, approved_by_name, lead_email, lead_name,
      header_config
    FROM budgets
    WHERE public_id = p_public_id
      AND status IN ('published', 'minuta_solicitada')
      AND public_id IS NOT NULL
    LIMIT 1
  ) t
$$;

-- Remove the overly-broad anon SELECT policy on budgets
DROP POLICY IF EXISTS "Public can view published budgets by public_id" ON public.budgets;
