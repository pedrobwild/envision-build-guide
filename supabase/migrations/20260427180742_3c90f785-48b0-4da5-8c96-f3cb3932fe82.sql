
-- Função para gerar public_id único (12 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION public.generate_budget_public_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  exists_count int;
BEGIN
  LOOP
    -- Gera 12 chars alfanuméricos lowercase a partir de UUID
    candidate := lower(replace(gen_random_uuid()::text, '-', ''));
    candidate := substring(candidate from 1 for 12);
    SELECT COUNT(*) INTO exists_count FROM public.budgets WHERE public_id = candidate;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Backfill: gera public_id para todos os orçamentos sem ele
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.budgets WHERE public_id IS NULL OR public_id = '' LOOP
    UPDATE public.budgets
       SET public_id = public.generate_budget_public_id()
     WHERE id = rec.id;
  END LOOP;
END $$;

-- Trigger que garante public_id em novos inserts
CREATE OR REPLACE FUNCTION public.ensure_budget_public_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.public_id IS NULL OR NEW.public_id = '' THEN
    NEW.public_id := public.generate_budget_public_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_budget_public_id ON public.budgets;
CREATE TRIGGER trg_ensure_budget_public_id
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_budget_public_id();
