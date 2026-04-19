
CREATE SEQUENCE IF NOT EXISTS public.client_sequential_code_seq START 1;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sequential_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_client_sequential_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sequential_code IS NULL OR NEW.sequential_code = '' THEN
    NEW.sequential_code := 'CLI-' || LPAD(nextval('public.client_sequential_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_client_sequential_code ON public.clients;
CREATE TRIGGER trg_generate_client_sequential_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_sequential_code();

-- Backfill existing clients ordered by created_at
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE sequential_code IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.clients
      SET sequential_code = 'CLI-' || LPAD(nextval('public.client_sequential_code_seq')::text, 4, '0')
      WHERE id = r.id;
  END LOOP;
END $$;
