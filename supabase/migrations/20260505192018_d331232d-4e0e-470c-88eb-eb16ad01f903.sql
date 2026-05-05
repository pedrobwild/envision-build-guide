DROP FUNCTION IF EXISTS public.restore_budget(uuid);

CREATE OR REPLACE FUNCTION public.list_deleted_budgets(p_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, sequential_code text, client_name text, project_name text, internal_status text, deleted_at timestamp with time zone, deleted_by uuid, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.sequential_code, b.client_name, b.project_name,
         b.internal_status, b.deleted_at, b.deleted_by, b.created_at
  FROM public.budgets b
  WHERE b.deleted_at IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'orcamentista'::app_role)
    )
  ORDER BY b.deleted_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 1000));
$function$;

CREATE OR REPLACE FUNCTION public.restore_budget(p_budget_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'orcamentista'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin or orcamentista required)';
  END IF;

  UPDATE public.budgets
     SET deleted_at = NULL,
         deleted_by = NULL,
         updated_at = now()
   WHERE id = p_budget_id
     AND deleted_at IS NOT NULL
   RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_budget(p_budget_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'orcamentista'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges (admin or orcamentista required)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.budgets WHERE id = p_budget_id AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Orçamento não está na lixeira';
  END IF;

  DELETE FROM public.item_images WHERE item_id IN (
    SELECT i.id FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
     WHERE s.budget_id = p_budget_id
  );
  DELETE FROM public.items WHERE section_id IN (
    SELECT id FROM public.sections WHERE budget_id = p_budget_id
  );
  DELETE FROM public.sections WHERE budget_id = p_budget_id;
  DELETE FROM public.budgets WHERE id = p_budget_id;
END;
$function$;

DELETE FROM public.user_roles
 WHERE user_id = '9a9cd22d-9e47-4a98-9ecb-479abc2144f1'
   AND role = 'admin'::app_role;