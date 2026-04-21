-- Fix orphan budgets: groups with no current version (version_group_id set, but is_current_version=false on all rows)
-- This happens when createNewVersion demoted current but the INSERT of the new version failed.
-- Heal them by re-marking the highest version_number in the group as current.
WITH orphan_groups AS (
  SELECT version_group_id
  FROM public.budgets
  WHERE version_group_id IS NOT NULL
  GROUP BY version_group_id
  HAVING COUNT(*) FILTER (WHERE is_current_version = true) = 0
),
to_promote AS (
  SELECT DISTINCT ON (b.version_group_id) b.id
  FROM public.budgets b
  JOIN orphan_groups og ON og.version_group_id = b.version_group_id
  ORDER BY b.version_group_id, b.version_number DESC NULLS LAST, b.created_at DESC
)
UPDATE public.budgets
SET is_current_version = true,
    updated_at = now()
WHERE id IN (SELECT id FROM to_promote);

-- Audit log for healing
INSERT INTO public.budget_events (budget_id, event_type, note, metadata, created_at)
SELECT id, 'version_healed_current',
       'Versão re-marcada como atual (healing automático de grupo órfão)',
       jsonb_build_object('reason', 'auto_heal_orphan_version_group'),
       now()
FROM public.budgets
WHERE version_group_id IS NOT NULL
  AND is_current_version = true
  AND updated_at > now() - INTERVAL '1 minute';