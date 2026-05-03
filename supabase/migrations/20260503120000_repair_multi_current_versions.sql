-- =============================================================================
-- Reparo: orçamentos onde múltiplas versões do MESMO grupo aparecem com
-- is_current_version = true.
--
-- O índice único `uniq_current_per_group` (criado em 20260501004830) impede
-- novos casos, mas dados gravados antes do índice — ou em janelas com o
-- índice ainda não promovido — ainda podem violar a invariante. Este reparo
-- mantém apenas UMA versão "atual" por grupo, escolhendo deterministicamente
-- a de maior version_number (e, em empate, o created_at mais recente).
-- Idempotente: se nada está fora de ordem, não modifica nenhuma linha.
-- =============================================================================

BEGIN;

WITH ranked AS (
  SELECT
    b.id,
    b.version_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY b.version_group_id
      ORDER BY b.version_number DESC NULLS LAST,
               b.created_at     DESC NULLS LAST,
               b.id             DESC
    ) AS rn
    FROM public.budgets b
   WHERE b.is_current_version = true
     AND b.version_group_id IS NOT NULL
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.budgets
   SET is_current_version = false,
       updated_at = now()
 WHERE id IN (SELECT id FROM losers);

-- Mesma higiene para is_published_version: garante no máximo 1 publicada
-- por grupo. Critério de desempate: é a versão atual, depois maior version_number.
WITH ranked_pub AS (
  SELECT
    b.id,
    b.version_group_id,
    ROW_NUMBER() OVER (
      PARTITION BY b.version_group_id
      ORDER BY b.is_current_version DESC NULLS LAST,
               b.version_number     DESC NULLS LAST,
               b.created_at         DESC NULLS LAST,
               b.id                 DESC
    ) AS rn
    FROM public.budgets b
   WHERE b.is_published_version = true
     AND b.version_group_id IS NOT NULL
),
losers_pub AS (
  SELECT id FROM ranked_pub WHERE rn > 1
)
UPDATE public.budgets
   SET is_published_version = false,
       updated_at = now()
 WHERE id IN (SELECT id FROM losers_pub);

COMMIT;
