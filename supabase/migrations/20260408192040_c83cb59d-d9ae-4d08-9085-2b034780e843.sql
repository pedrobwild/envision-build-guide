
-- 1. Add columns to budgets
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS budget_pdf_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_total numeric DEFAULT NULL;

-- 2. Create storage bucket for budget PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('budget-pdfs', 'budget-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for budget-pdfs bucket
-- Read: anyone (public bucket for published budgets)
CREATE POLICY "Anyone can read budget PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'budget-pdfs');

-- Upload: authenticated users with admin/comercial/orcamentista role
CREATE POLICY "Authenticated users can upload budget PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'budget-pdfs'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'comercial')
    OR public.has_role(auth.uid(), 'orcamentista')
  )
);

-- Delete: authenticated users with admin role only
CREATE POLICY "Admins can delete budget PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'budget-pdfs'
  AND public.has_role(auth.uid(), 'admin')
);

-- 4. Update status transition trigger to allow novo → delivered_to_sales
CREATE OR REPLACE FUNCTION public.validate_internal_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.internal_status IS NOT DISTINCT FROM NEW.internal_status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.internal_status = 'novo'              AND NEW.internal_status IN ('requested', 'triage', 'assigned', 'in_progress', 'delivered_to_sales'))
    OR (OLD.internal_status = 'requested'      AND NEW.internal_status IN ('triage', 'assigned', 'in_progress'))
    OR (OLD.internal_status = 'triage'         AND NEW.internal_status IN ('assigned', 'in_progress'))
    OR (OLD.internal_status = 'assigned'       AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'in_progress'    AND NEW.internal_status IN ('ready_for_review', 'blocked', 'waiting_info'))
    OR (OLD.internal_status = 'ready_for_review' AND NEW.internal_status IN ('delivered_to_sales', 'in_progress'))
    OR (OLD.internal_status = 'delivered_to_sales' AND NEW.internal_status IN ('sent_to_client', 'revision_requested'))
    OR (OLD.internal_status = 'sent_to_client' AND NEW.internal_status IN ('revision_requested', 'minuta_solicitada', 'lost', 'contrato_fechado'))
    OR (OLD.internal_status = 'revision_requested' AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'blocked'        AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'waiting_info'   AND NEW.internal_status IN ('in_progress'))
    OR (OLD.internal_status = 'minuta_solicitada' AND NEW.internal_status IN ('contrato_fechado', 'revision_requested'))
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.internal_status, NEW.internal_status;
  END IF;

  RETURN NEW;
END;
$function$;
