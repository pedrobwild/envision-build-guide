-- =============================================================================
-- Integridade de orçamentos e versões
-- Issue: https://github.com/pedrobwild/envision-build-guide/issues/15
--
-- Esta migration:
--   1) Repara dados existentes (parents órfãos)
--   2) Cria FK em parent_budget_id (ON DELETE SET NULL)
--   3) Cria índice unique parcial garantindo no máximo 1 is_current_version
--      por version_group_id
--   4) Cria índice unique parcial garantindo no máximo 1 is_published_version
--      por version_group_id
--   5) Cria a view v_budget_health para auditorias contínuas
--
-- A defesa em código (`safeDeleteBudget`) já foi aplicada em PR #16; esta
-- migration é a defesa em profundidade no banco.
-- =============================================================================

BEGIN;

-- 1) Reparo: limpar parent_budget_id quando apontam para um id inexistente.
--    Mantemos o histórico do `change_reason` e `version_group_id`; só zeramos
--    o ponteiro para o pai (que já não existe).
WITH orphans AS (
  SELECT b.id
    FROM public.budgets b
    LEFT JOIN public.budgets p ON p.id = b.parent_budget_id
   WHERE b.parent_budget_id IS NOT NULL
     AND p.id IS NULL
)
UPDATE public.budgets
   SET parent_budget_id = NULL,
       updated_at = now()
 WHERE id IN (SELECT id FROM orphans);

-- 1b) Reparo: limpar version_group_id quando aponta para um id inexistente
--     E o budget é um membro órfão de um grupo. Atribui o próprio id como novo
--     group_id (efetivamente "destacando" para um novo grupo de 1 versão).
--     Seguro porque se houvesse outros membros do mesmo grupo eles continuam
--     juntos via o group_id antigo (apenas este registro sai).
WITH group_orphans AS (
  SELECT b.id, b.version_group_id
    FROM public.budgets b
    LEFT JOIN public.budgets g ON g.id = b.version_group_id
   WHERE b.version_group_id IS NOT NULL
     AND g.id IS NULL
)
UPDATE public.budgets
   SET version_group_id = id,
       version_number = 1,
       is_current_version = true,
       updated_at = now()
 WHERE id IN (SELECT id FROM group_orphans);

-- 1c) Reparo: garantir no máximo 1 is_published_version=true por grupo.
--     Estratégia (segura e determinística):
--       - Se houver is_current_version=true no grupo, ela é a vencedora.
--       - Senão, vence a de maior version_number.
--     Os demais membros do grupo são despublicados (is_published_version=false).
--     Status (`status`) NÃO é alterado; só desligamos o flag de "é a publicação
--     vigente". Isso alinha com a UX (cliente sempre vê apenas a versão atual)
--     e evita quebrar o histórico.
WITH ranked AS (
  SELECT
    b.id,
    b.version_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY b.version_group_id
      ORDER BY b.is_current_version DESC NULLS LAST,
               b.version_number DESC NULLS LAST,
               b.created_at DESC
    ) AS rn
    FROM public.budgets b
   WHERE b.is_published_version = true
     AND b.version_group_id IS NOT NULL
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.budgets
   SET is_published_version = false,
       updated_at = now()
 WHERE id IN (SELECT id FROM losers);

-- 1d) Reparo: garantir no máximo 1 is_current_version=true por grupo.
--     Já vimos 0 grupos violando hoje, mas mantemos a salvaguarda para o caso
--     de uma race condition ter passado entre a query de auditoria e o apply.
WITH ranked_cur AS (
  SELECT
    b.id,
    b.version_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY b.version_group_id
      ORDER BY b.version_number DESC NULLS LAST,
               b.created_at DESC
    ) AS rn
    FROM public.budgets b
   WHERE b.is_current_version = true
     AND b.version_group_id IS NOT NULL
),
losers_cur AS (
  SELECT id FROM ranked_cur WHERE rn > 1
)
UPDATE public.budgets
   SET is_current_version = false,
       updated_at = now()
 WHERE id IN (SELECT id FROM losers_cur);

-- 2) FK parent_budget_id → budgets.id (ON DELETE SET NULL).
--    Use IF NOT EXISTS de forma defensiva (Postgres não suporta direto, então
--    usamos a checagem via pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'budgets_parent_budget_id_fkey'
       AND conrelid = 'public.budgets'::regclass
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_parent_budget_id_fkey
      FOREIGN KEY (parent_budget_id)
      REFERENCES public.budgets(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3) Único is_current_version=true por version_group_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_current_per_group
  ON public.budgets(version_group_id)
  WHERE is_current_version = true;

-- 4) Único is_published_version=true por version_group_id
CREATE UNIQUE INDEX IF NOT EXISTS uniq_published_per_group
  ON public.budgets(version_group_id)
  WHERE is_published_version = true;

-- 5) View de health-check
DROP VIEW IF EXISTS public.v_budget_health;
CREATE VIEW public.v_budget_health
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.public_id,
  b.project_name,
  b.client_name,
  b.version_group_id,
  b.version_number,
  b.is_current_version,
  b.is_published_version,
  b.status,
  b.internal_status,
  b.parent_budget_id,
  -- problema 1: parent órfão
  (b.parent_budget_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.budgets p WHERE p.id = b.parent_budget_id))
    AS has_orphan_parent,
  -- problema 2: version_group órfão
  (b.version_group_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.budgets g WHERE g.id = b.version_group_id))
    AS has_orphan_group,
  -- contagem de itens e quantos têm imagem
  (
    SELECT COUNT(*)
      FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
     WHERE s.budget_id = b.id
  ) AS total_items,
  (
    SELECT COUNT(DISTINCT i.id)
      FROM public.items i
      JOIN public.sections s ON s.id = i.section_id
      JOIN public.item_images ii ON ii.item_id = i.id
     WHERE s.budget_id = b.id
  ) AS items_with_image,
  b.created_at,
  b.updated_at
FROM public.budgets b;

COMMENT ON VIEW public.v_budget_health IS
  'Health-check de orçamentos. Veja issue #15 e use queries como:
   SELECT * FROM v_budget_health WHERE has_orphan_parent OR has_orphan_group;
   SELECT public_id, project_name, total_items, items_with_image
     FROM v_budget_health
    WHERE is_published_version = true AND total_items > 0
    ORDER BY (1.0 - items_with_image::numeric / NULLIF(total_items,0)) DESC;';

GRANT SELECT ON public.v_budget_health TO authenticated;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual; rode em transação se precisar reverter):
--
--   BEGIN;
--   DROP VIEW IF EXISTS public.v_budget_health;
--   DROP INDEX IF EXISTS public.uniq_published_per_group;
--   DROP INDEX IF EXISTS public.uniq_current_per_group;
--   ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_parent_budget_id_fkey;
--   COMMIT;
--
-- (O passo de reparo de dados (1) não é revertível porque os parents apontavam
--  para registros que já não existiam.)
-- =============================================================================
