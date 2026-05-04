-- =============================================================================
-- guard_published_budget_update: completa v_safe_cols com 3 campos
-- de lifecycle de venda que faltavam.
--
-- Sintoma: ao mover um orçamento já publicado para "Contrato Fechado" pelo
-- Painel Comercial, o `ContractUploadModal` fazia
--   UPDATE budgets SET internal_status, contract_file_url, closed_at, …
-- e o guard barrava porque `contract_file_url` e `closed_at` não estavam
-- na whitelist (ERRCODE='check_violation', message
-- 'published_budget_immutable: tentativa de alterar campo(s) …').
-- O comercial via "Erro ao enviar contrato: Tente novamente" e o status
-- ficava intacto. Reportado em
-- claude/fix-contract-stage-error-mthpZ.
--
-- Esta migration estende a lista da versão 20260501094429:
--   • contract_file_url  → anexo do contrato pós-venda
--   • closed_at          → timestamp de fechamento da venda
--   • win_probability    → derivado de pipeline_stage (defesa: caso outro
--                          BEFORE trigger venha a recalcular antes do guard)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_published_budget_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changed_cols text[] := ARRAY[]::text[];
  v_safe_cols text[] := ARRAY[
    'view_count','last_viewed_at',
    'deleted_at','deleted_by',
    'updated_at',
    'is_published_version','status','published_at',
    'public_id',
    -- Workflow interno (não afeta conteúdo público):
    'internal_status','internal_deadline','priority',
    'commercial_owner_id','estimator_owner_id',
    'internal_notes',
    -- Vínculos organizacionais (não afetam conteúdo público):
    'property_id','client_id','pipeline_id','pipeline_stage',
    -- Lifecycle de venda (gravados ao fechar contrato; não estão no snapshot):
    'closed_at','contract_file_url','win_probability'
  ];
BEGIN
  IF COALESCE(OLD.is_published_version, false) = false THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(col)
    INTO v_changed_cols
  FROM (
    SELECT key AS col
      FROM jsonb_each(to_jsonb(NEW)) n
      LEFT JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value
  ) diff;

  IF v_changed_cols IS NULL THEN
    RETURN NEW;
  END IF;

  v_changed_cols := ARRAY(
    SELECT c FROM unnest(v_changed_cols) c
    WHERE c <> ALL(v_safe_cols)
  );

  IF array_length(v_changed_cols, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'published_budget_immutable: tentativa de alterar campo(s) {%} em orçamento publicado (id=%). Crie uma nova versão (fork) antes de editar.',
    array_to_string(v_changed_cols, ','),
    OLD.id
    USING ERRCODE = 'check_violation',
          HINT = 'Use duplicateBudgetAsVersion() para criar uma nova versão editável.';
END;
$function$;
