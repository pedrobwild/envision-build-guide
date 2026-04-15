---
name: Operations start date
description: Dashboard metrics only count budgets created from 2026-04-15 onwards (OPERATIONS_START_DATE constant)
type: feature
---
The constant `OPERATIONS_START_DATE` (2026-04-15) in `useDashboardMetrics.ts` filters out all budgets created before that date from KPI calculations, funnels, financials, and team metrics. The budgets still exist in the database — they are only excluded from the executive dashboard and team metrics panel.
