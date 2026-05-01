-- ============================================================
-- Painel por papel (Comercial / Orçamentista / Admin)
--
-- Objetivo: permitir que usuários com múltiplos papéis (ex.: CEO
-- que também é admin) escolham qual painel querem usar como home,
-- sem perder os papéis atribuídos em `user_roles`.
--
-- Decisões:
--   • `active_role` vive em `profiles` (1 valor por usuário).
--   • Default: NULL → o front resolve o fallback consultando
--     `user_roles` (admin > comercial > orcamentista).
--   • Constraint garante que `active_role` seja um papel que o
--     usuário de fato possui (evita troca para um papel não
--     atribuído via cliente).
--   • Inclui RPC `set_active_role(_role)` que valida e persiste,
--     usado pelo Role Switcher do header.
-- ============================================================

-- 1. Coluna ----------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role public.app_role;

COMMENT ON COLUMN public.profiles.active_role IS
  'Papel atualmente selecionado pelo usuário no Role Switcher. NULL = usar papel primário (fallback).';

-- 2. Função de validação --------------------------------------
-- Verifica se o caller pode assumir esse papel.
CREATE OR REPLACE FUNCTION public.user_has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

COMMENT ON FUNCTION public.user_has_role(uuid, public.app_role) IS
  'True se o usuário possui o papel informado em user_roles.';

GRANT EXECUTE ON FUNCTION public.user_has_role(uuid, public.app_role) TO authenticated;

-- 3. RPC para definir active_role -----------------------------
-- O front chama supabase.rpc('set_active_role', { _role: 'comercial' }).
-- Falha se o caller não possui esse papel.
CREATE OR REPLACE FUNCTION public.set_active_role(_role public.app_role)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sem sessão autenticada';
  END IF;

  IF NOT public.user_has_role(_uid, _role) THEN
    RAISE EXCEPTION 'Usuário não possui o papel %', _role
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET active_role = _role,
         updated_at  = now()
   WHERE id = _uid;

  RETURN _role;
END;
$$;

COMMENT ON FUNCTION public.set_active_role(public.app_role) IS
  'Define o papel ativo do usuário autenticado. Valida posse via user_roles.';

GRANT EXECUTE ON FUNCTION public.set_active_role(public.app_role) TO authenticated;

-- 4. RPC para limpar (voltar ao papel primário) ---------------
CREATE OR REPLACE FUNCTION public.clear_active_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sem sessão autenticada';
  END IF;

  UPDATE public.profiles
     SET active_role = NULL,
         updated_at  = now()
   WHERE id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_active_role() TO authenticated;

-- 5. View de configurações de esfriamento por etapa -----------
-- Thresholds (em dias úteis aproximados como dias corridos no MVP)
-- usados pela home Comercial para classificar negócios "esfriando".
-- Centraliza para evoluir para uma tabela de regras configuráveis.
CREATE OR REPLACE VIEW public.v_pipeline_cooldown_rules AS
SELECT * FROM (
  VALUES
    ('sent_to_client',     5,  'Proposta enviada ≥5d sem retorno'),
    ('minuta_solicitada', 10,  'Negociação ≥10d sem avanço'),
    ('waiting_info',       3,  'Aguardando info ≥3d')
) AS t(stage, threshold_days, description);

COMMENT ON VIEW public.v_pipeline_cooldown_rules IS
  'Regras de esfriamento por etapa do funil — MVP estático, futura tabela editável.';

GRANT SELECT ON public.v_pipeline_cooldown_rules TO authenticated;
