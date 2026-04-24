-- Aditivos: marca orçamentos como aditivos contratuais com aprovação dedicada do cliente
-- e marca itens/seções como adições ou remoções para cálculo do delta financeiro.

-- 1. Colunas em budgets para identificar aditivo
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS is_addendum BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addendum_number INTEGER,
  ADD COLUMN IF NOT EXISTS addendum_base_budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS addendum_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS addendum_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS addendum_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_budgets_is_addendum ON public.budgets(is_addendum) WHERE is_addendum = true;
CREATE INDEX IF NOT EXISTS idx_budgets_addendum_base ON public.budgets(addendum_base_budget_id) WHERE addendum_base_budget_id IS NOT NULL;

-- 2. Colunas em sections e items para marcar a ação do aditivo
-- 'add'    => item/seção adicionada pelo aditivo (soma ao total)
-- 'remove' => item/seção removida pelo aditivo (subtrai do total; mantém o valor original como referência)
-- NULL     => sem alteração (herdado do orçamento base)
ALTER TABLE public.sections
  ADD COLUMN IF NOT EXISTS addendum_action TEXT
  CHECK (addendum_action IS NULL OR addendum_action IN ('add','remove'));

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS addendum_action TEXT
  CHECK (addendum_action IS NULL OR addendum_action IN ('add','remove'));

CREATE INDEX IF NOT EXISTS idx_sections_addendum_action ON public.sections(addendum_action) WHERE addendum_action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_addendum_action ON public.items(addendum_action) WHERE addendum_action IS NOT NULL;

-- 3. RLS: permitir cliente anônimo aprovar aditivo (similar ao approve fluxo já existente)
-- A aprovação do aditivo pelo cliente acontece via UPDATE em budgets onde is_addendum=true e public_id está presente.
-- Já coberto pela política existente "Anon can view published budgets" (SELECT) e UPDATE controlado por edge function/admin.
-- Para permitir aprovação anônima sem expor outros campos, criamos RPC dedicada.

CREATE OR REPLACE FUNCTION public.approve_addendum(
  p_public_id TEXT,
  p_approved_by_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_public_id IS NULL OR length(trim(p_public_id)) = 0 THEN
    RETURN false;
  END IF;
  IF p_approved_by_name IS NULL OR length(trim(p_approved_by_name)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.budgets
     SET addendum_approved_at = now(),
         addendum_approved_by_name = p_approved_by_name,
         updated_at = now()
   WHERE public_id = p_public_id
     AND is_addendum = true
     AND status IN ('published','minuta_solicitada')
     AND addendum_approved_at IS NULL
   RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_addendum(TEXT, TEXT) TO anon, authenticated;