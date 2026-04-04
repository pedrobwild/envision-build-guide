-- Add sequential_code column
ALTER TABLE public.budgets ADD COLUMN sequential_code text UNIQUE;

-- Create sequence for budget codes
CREATE SEQUENCE public.budget_sequential_code_seq START WITH 1;

-- Backfill existing budgets with sequential codes based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.budgets
)
UPDATE public.budgets b
SET sequential_code = 'ORC-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE b.id = n.id;

-- Set sequence to continue after existing budgets
SELECT setval('public.budget_sequential_code_seq', COALESCE((SELECT COUNT(*) FROM public.budgets), 0));

-- Create trigger function to auto-generate sequential_code on insert
CREATE OR REPLACE FUNCTION public.generate_budget_sequential_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.sequential_code IS NULL THEN
    NEW.sequential_code := 'ORC-' || LPAD(nextval('public.budget_sequential_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budget_sequential_code
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_sequential_code();