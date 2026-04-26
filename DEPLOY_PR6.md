# Deploy PR #6 — fix do 504 em bulk operations

PR mergeada: `c8ab0ecc..1289f173` (main).
Projeto de produção: `pieenhgjulsrjlioozsy`.

## Pré-requisitos (uma vez só)

```bash
# Instalar Supabase CLI (se ainda não tiver)
brew install supabase/tap/supabase   # macOS
# ou: npm i -g supabase

# Login
supabase login

# Linkar o repo ao projeto de produção
cd envision-build-guide
git pull origin main          # garante que está com a PR #6
supabase link --project-ref pieenhgjulsrjlioozsy
```

## Deploy em 3 passos

### 1) Aplicar a migration (RPCs + colunas de progresso)

```bash
supabase db push
```

O que vai aplicar:
- Expande CHECK em `ai_bulk_operations.action_type` (aceita `financial_adjustment`, `update_internal_status`, `update_pipeline_stage`, etc.)
- Aceita status `running` em `ai_bulk_operations`
- Adiciona colunas: `applicable_count`, `processed_count`, `affected_count`, `heartbeat_at`, `error_message`
- Cria RPC `bulk_apply_factor_to_items(operation_id, factor)` — atualiza todos os itens + sections em uma única transação
- Cria RPC `count_eligible_budgets(filters jsonb)` — contagem rápida com os filtros

> Se preferir aplicar manualmente: cole o conteúdo de
> `supabase/migrations/20260426143000_ai_bulk_scale_200plus.sql`
> no SQL Editor do Supabase Studio do projeto `pieenhgjulsrjlioozsy`.

### 2) Deployar a Edge Function

```bash
supabase functions deploy ai-bulk-operations --project-ref pieenhgjulsrjlioozsy
```

Mudanças principais:
- `MAX_AFFECTED` 500 → **1000**
- `BACKGROUND_THRESHOLD = 50` (acima disso, retorna 200 OK imediato e roda em background com `EdgeRuntime.waitUntil`)
- Novo filtro `pipeline_stages` (resolve "em negociação" → `pipeline_stage='negociacao'`)
- Novo filtro `internal_statuses`
- Nova action `status` para polling do progresso
- Usa RPC `bulk_apply_factor_to_items` no lugar do UPDATE row-by-row (resolve o 504)
- Fallback automático para o caminho antigo se a RPC não existir (rollout seguro)

### 3) Build + deploy do front

O front foi atualizado (`useBulkOperations.ts`, `AiAssistant.tsx`, `types.ts`) para:
- Receber resposta `background: true` e iniciar polling automático a cada 2s
- Mostrar progresso real (`processed_count / applicable_count`) em vez de estimativa
- Suportar até 15min de operação

```bash
npm ci
npm run build
# deploy do dist/ conforme seu pipeline atual (Vercel/Netlify/Lovable/etc)
```

## Validação pós-deploy

1. No AI Assistant: peça "reduzir 10% em todos os orçamentos em negociação"
2. Esperado:
   - Plan retorna com `applicable_count` correto (use `count_eligible_budgets` para conferir)
   - Apply retorna **200 OK em <2s** com `{ background: true, operation_id }`
   - Front começa a fazer polling e mostra "Processando X de Y"
   - Operação termina em ~30-90s para 200 orçamentos (vs. timeout antes)
3. Conferir tabela `ai_bulk_operations`:
   ```sql
   select id, status, applicable_count, processed_count, affected_count, heartbeat_at, error_message
   from ai_bulk_operations
   order by created_at desc limit 5;
   ```

## Rollback (se precisar)

```bash
# Reverter edge function
git revert 1289f173
supabase functions deploy ai-bulk-operations --project-ref pieenhgjulsrjlioozsy

# Migration: as RPCs e colunas novas não quebram nada se ficarem
# (a edge function antiga não as usa). Pode deixar.
```

## Mitigação enquanto não deploya

Refine o filtro pra rodar em lotes de até ~50 orçamentos:
- "reduzir 10% nos orçamentos em negociação do cliente X"
- "reduzir 10% nos em negociação criados nos últimos 30 dias"
- "reduzir 10% nos em negociação acima de R$ 100k" (depois <100k)
