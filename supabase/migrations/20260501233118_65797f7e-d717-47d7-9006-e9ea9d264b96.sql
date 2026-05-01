-- 1) Deduplicar: manter apenas a linha mais recente (updated_at desc) por (owner_id, target_month)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(owner_id::text, '__null__'), target_month
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.commercial_targets
)
DELETE FROM public.commercial_targets ct
USING ranked r
WHERE ct.id = r.id AND r.rn > 1;

-- 2) Índice único parcial para owner_id NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS commercial_targets_owner_month_uniq
  ON public.commercial_targets (owner_id, target_month)
  WHERE owner_id IS NOT NULL;

-- 3) Índice único parcial para owner_id NULL (meta global)
CREATE UNIQUE INDEX IF NOT EXISTS commercial_targets_global_month_uniq
  ON public.commercial_targets (target_month)
  WHERE owner_id IS NULL;