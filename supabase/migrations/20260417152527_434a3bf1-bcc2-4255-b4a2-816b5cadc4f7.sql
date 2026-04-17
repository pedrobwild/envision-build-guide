CREATE OR REPLACE FUNCTION public.validate_internal_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow any transition; status flow is now fully flexible.
  -- Validation/confirmation is handled at the application layer.
  RETURN NEW;
END;
$function$;