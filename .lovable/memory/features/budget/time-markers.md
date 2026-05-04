---
name: Budget time markers
description: RPC get_budget_time_markers fornece criação, início da etapa atual e congelamento; consumida via useBudgetTimeMarkers como fonte de verdade dos chips "Aberto há X dias" e "Nesta etapa há X dias"
type: feature
---
A RPC `public.get_budget_time_markers(p_budget_id uuid)` (SECURITY INVOKER, GRANT EXECUTE para `authenticated`) retorna `created_at`, `current_stage_start` (último `status_change` com `to_status = internal_status`, fallback em `created_at`), `frozen_at` (PRIMEIRO `status_change` para `contrato_fechado`/`lost`/`archived`, NULL se ativo), `is_frozen` e `reference_at`.

No frontend, `useBudgetTimeMarkers(budgetId, internalStatus)` (em `src/hooks/useBudgetTimeMarkers.ts`) consome a RPC e re-busca quando `internal_status` muda. `BudgetInternalDetail` prefere `budgetTimeFromMarkers` (em `src/lib/budget-time-in-stage.ts`); se a RPC ainda não respondeu, faz fallback para `computeBudgetTime` sobre `events` carregados.

Regras invariantes (testadas em `src/lib/__tests__/budget-time-in-stage.test.ts`):
- Eventos posteriores ao primeiro `status_change` final NÃO estendem o cronômetro.
- Se o orçamento sair de um estado final (raro), `is_frozen` volta a `false` e o cronômetro destrava.
- `differenceInCalendarDays` ⇒ 0 = "hoje"; nunca negativo.
