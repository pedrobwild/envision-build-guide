# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

BWild "Envision Build Guide" is a Portuguese-language (pt-BR) SPA used internally by a renovation company (Bwild Arquitetura & Construção) plus a public-facing interactive budget viewer. The frontend is built with **Vite + React 18 + TypeScript + shadcn/ui + Tailwind**, and the entire backend is **Supabase** (Postgres with RLS, Auth, Storage, Edge Functions on Deno). The app is hosted via **Lovable** (`lovable-tagger` is a dev-only Vite plugin) — pushes to git auto-deploy through Lovable.

## Commands

```bash
npm run dev          # Vite dev server on :8080 (HMR overlay disabled)
npm run build        # production build (auto-injects VITE_APP_VERSION)
npm run build:dev    # build with mode=development (keeps componentTagger)
npm run lint         # ESLint over **/*.{ts,tsx} (ignores dist + supabase/functions)
npm run test         # vitest run (jsdom, see vitest.config.ts)
npm run test:watch   # vitest in watch mode
npx vitest run src/lib/__tests__/budget-total.test.ts   # single file
npx vitest run -t "calcSectionCostTotal"                # filter by test name
```

### Supabase / deploy

```bash
supabase link --project-ref pieenhgjulsrjlioozsy   # production project
supabase db push                                    # apply pending migrations
supabase functions deploy <name> --project-ref pieenhgjulsrjlioozsy
```

Per-function JWT settings live in `supabase/config.toml` — webhooks (`*-webhook`, sync functions, `notify-budget-view`, `ai-sync-monitor`) intentionally set `verify_jwt = false`.

`scripts/verify-supabase-types.ts` (run via `bun` or `tsx`) fails CI if `REQUIRED_TABLES` are missing from the generated types — run it after editing migrations and regenerating `src/integrations/supabase/types.ts`.

## Architecture

### Routing & shells

`src/App.tsx` is the single source of truth for routes. Every page is **lazy-loaded** (`React.lazy`) and wrapped in a chunk-error boundary so failed chunk loads after a deploy don't soft-brick the app — `installChunkErrorTelemetry` in `src/main.tsx` reports these to Supabase along with `VITE_APP_VERSION`.

Three composable wrappers control access:
- `<ProtectedRoute>` — requires authenticated user.
- `<AdminLayout>` — sidebar + topbar shell for `/admin/*` and `/painel/*`.
- `<RoleGuard allowedRoles={[...]}>` — gates by `AppRole` (`admin | comercial | orcamentista`).
- `<RoleRedirect>` — used on `/`, `/admin`, `/painel` to send the user to `homePathForRole(activeRole)` (resolved from `profiles.active_role` with admin → comercial → orcamentista fallback).

The shorthand `<AdminPage>` in `App.tsx` is `ProtectedRoute → AdminLayout → PageErrorBoundary`. Use it for all internal routes.

### State & data

- Single `QueryClient` (TanStack Query) at the root with `staleTime: 2 min`, `refetchOnWindowFocus: false`. New data hooks should live under `src/hooks/` and return query objects directly — keep components transport-agnostic.
- Auth state comes from `AuthProvider` (`useAuth`) — note the careful handling of transient null sessions and the 8s safety timer in `useAuth.tsx`. Don't replace the auth flow with a naive `getSession()` call.
- User profile / roles come from `UserProfileProvider` (`useUserProfile`) and the active role from `useActiveRole`.
- Supabase client is **not** instantiated per-call. Always import: `import { supabase } from "@/integrations/supabase/client";`. The file is generated — do not edit. Auth uses `localStorage` with autoRefresh on; `installAuthFetchRetry` and `installAuthSessionRecovery` (run from `main.tsx`) wrap fetch to recover from refresh-token failures without forcing a reload.

### Path alias

`@/*` resolves to `./src/*` in `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`. Always import via `@/...`, never relative ascending paths.

### Build chunking

`vite.config.ts` manually splits `react-vendor`, `supabase`, `tanstack-query`, `framer`, and `radix-core` into dedicated chunks; PDF/Map/cmdk libs are intentionally lazy-loaded by routes. When adding a heavy dependency, decide whether it should join an existing chunk or stay lazy — adding it to the entry without thought regresses initial load.

### Domain model

The core entity is `budgets`. **Versioning is non-trivial** and most bugs come from misunderstanding it (`src/lib/budget-versioning.ts`):
- Every budget belongs to a `version_group_id` (defaults to its own `id` for v1).
- `is_current_version` — exactly one per group is the active draft.
- `is_published_version` — the version visible at `/o/:publicId`.
- Drafts are NOT publicly visible; RLS + the RPC `get_public_budget` only serve `published` / `minuta_solicitada` rows.
- **Never open a public budget with `window.open(getPublicBudgetUrl(...))` directly.** Use `openPublicBudget(budget, opts)` when you have the full row, or `openPublicBudgetByPublicId(publicId)` when you only have the id — both in `src/lib/openPublicBudget.ts`. They resolve the latest published sibling via the `resolve_published_public_id` RPC and fall back to auto-publishing the current draft. `PublicBudget.tsx` also calls the same RPC server-side as a defense layer for already-shared links.

Status is two-axis:
- `internal_status` — internal Kanban (e.g. `novo`, `in_progress`, `delivered_to_sales`, `contrato_fechado`). See `INTERNAL_STATUSES`, `STATUS_GROUPS`, and `STATUS_TRANSITIONS` in `src/lib/role-constants.ts`. The DB trigger `validate_internal_status_transition` enforces these — keep both in sync.
- `pipeline_stage` — commercial pipeline (`lead`, `briefing`, `visita`, `proposta`, `negociacao`).

`OPERATIONS_START_DATE` (in `useDashboardMetrics.ts`, currently `2026-04-15`) filters out earlier budgets from KPIs/funnels/financials/team metrics — older rows still exist in the DB but are excluded from the executive dashboard.

### Edge functions (Deno)

`supabase/functions/` is **not** linted by ESLint (different runtime/globals — see `eslint.config.js`). Each function is a `serve(...)` entrypoint with its own CORS headers; shared helpers live in `supabase/functions/_shared/`.

Notable functions and their UI surfaces:
- `ai-assistant-chat` ↔ `src/components/AiAssistant.tsx` — streaming SSE chat with tool calling (`query_analytics`, `get_kpi_trend`, `top_entities`, `web_market_research`, `submit_bug_report`, `query_bug_reports`). Service-role is server-only; tools are read-only and whitelisted in `TABLE_CONFIG`. Admin role is revalidated server-side. See `docs/AI_ASSISTANT.md`.
- `ai-bulk-operations` ↔ `src/components/ai-assistant/useBulkOperations.ts` — admin-only batch operations on budgets. Hard caps in the function: `MAX_AFFECTED = 1000`, `BACKGROUND_THRESHOLD = 50` (above this, returns `{ background: true, operation_id }` and the front polls `action: "status"` every ~2s for up to 15 min). `PROTECTED_STATUSES = ['contrato_fechado','perdido','lost','archived']` are excluded in **both** the query and the executor — never relax this. Financial adjustments call the `bulk_apply_factor_to_items(p_budget_ids, p_factor)` RPC; **parameter names must match exactly** (`p_*` prefix) or PostgREST silently falls through to row-by-row updates and may produce identical clones with no change applied. After the RPC, if `factor != 1` and `items_updated == 0 && sections_updated == 0`, throw — this guards against silent regression. See `docs/ai-bulk-operations.md`.
- `bug-report-triage` — invoked in `create` mode from chat (`submit_bug_report`) or `extend` mode from the `BugReporter` drawer / admin "Retriagem IA" button. Populates `severity_ai`, `area_ai`, `triage_summary`, `triage_tags`, `duplicate_of` via `gpt-4o-mini`.
- Sync pair `sync-supplier-outbound` / `sync-supplier-inbound` and `sync-project-outbound` (fires on `internal_status → contrato_fechado`) ↔ Portal BWild. Authentication is `x-integration-key`, **not** JWT. Idempotency via `integration_sync_log` UNIQUE on `(source_system, entity_type, source_id)`. See `docs/envision-integration-reference.md` and `docs/envision-budget-payload-schema.md`.

### AI data analysis (frontend-only)

`src/lib/ai-data/` is a deterministic, pure-TypeScript insight engine — no LLM calls. The orchestrator is `runInsightEngine` and the NL planner is `analysisPlanner`. UI consumes it through `src/hooks/ai-data/useAiDataAnalysis.ts` and `src/components/ai-analysis/`. Adding metrics or insight types follows a defined recipe documented in `docs/AI_DATA_ANALYSIS.md` — when you add a metric, also extend `metricDefinitions.ts` and (if there's a common PT-BR synonym) `domainGlossary.ts`. Generators must return `[]` plus a `limitation` when data is insufficient instead of hallucinating numbers.

### shadcn/ui conventions

`components.json` registers shadcn with `style: default`, `baseColor: slate`, no prefix. Primitives live in `src/components/ui/` and are extended (not duplicated) — the design system's tokens are HSL CSS variables defined in `src/index.css` and aliased through `tailwind.config.ts` (`gold`, `charcoal`, `cream`, `success`, `info`, plus an Enterprise Painel layer: `canvas`, `surface-1..3`, `hairline`, `ink-strong/medium/soft/faint`). Use those token classes; avoid raw hex/Tailwind palette colors.

Fonts: `font-display` (Sora), `font-body` (Inter), `font-mono` (Geist Mono).

## Conventions specific to this codebase

- **Language**: UI strings, comments, commit messages, and DB labels are in **Portuguese (pt-BR)**. Match that when extending strings or writing new components.
- **TypeScript**: `strictNullChecks: false`, `noImplicitAny: false`, `noUnusedLocals: false`. Don't fight the relaxed config — but new code should still type narrow where possible. ESLint disables `@typescript-eslint/no-unused-vars` and warns on `react-refresh/only-export-components`.
- **Logger**: prefer `import { logger } from "@/lib/logger"` over raw `console.*` so the console-error buffer (`installConsoleErrorBuffer`) and BugReporter can collect context.
- **Postgres escaping**: when filtering on user input that's interpolated into PostgREST query strings, use the helpers in `src/lib/postgrest-escape.ts` — there are tests guarding this.
- **Money & totals**: `src/lib/budget-calc.ts` is the canonical math. Sections titled exactly `"Descontos"` and `"Créditos"` are abatement buckets (see `isDiscountSection` / `isCreditSection`); credits reduce the client-facing total but **do not** affect internal margin. Tests in `src/lib/__tests__/budget-discount-credit.test.ts` and `budget-abatement-validation.test.ts` codify the invariants.
- **Env vars**: only `VITE_*`-prefixed vars are exposed to the client (Vite rule). Server-side secrets (`OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `INTEGRATION_INBOUND_KEY`, `PORTAL_BWILD_*`) live in Supabase function secrets, never in `.env`.
- **Migrations**: filename format is `YYYYMMDDHHMMSS_<slug>.sql`. Migrations are append-only — keep RLS policies in the same migration as the table they protect when possible.
- **`.lovable/memory/`**: Lovable-managed feature notes (bulk operations, safe public budget open, operations start date). Treat as source of truth for the constraints they describe; mirror behavior changes into both code + memory note.

## Things that have burned us before

- Cloning a budget version while another writer flips `is_current_version` can leave a group with zero current versions. `duplicateBudgetAsVersion` and `cloneBudgetAsNewVersion` insert the new row first, then demote/promote — preserve that order.
- `bulk_apply_factor_to_items` parameter names: the RPC signature is `(p_budget_ids uuid[], p_factor numeric)`. Calling with `{_budget_ids, _factor}` won't error — it silently falls through. The post-RPC `items_updated == 0 && sections_updated == 0` guard exists to catch this.
- Public budget links shared in WhatsApp may point to v1 while the admin keeps editing v5. The `resolve_published_public_id` redirect in `PublicBudget.tsx` is what keeps those links working — don't strip it when refactoring.
- `RoleGuard` must wrap inside `AdminPage` (not outside), because it relies on `useUserProfile` which is provided above the routes but the AdminLayout shell is what gives the page chrome.
