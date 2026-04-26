# Casos de teste manuais para filtros estruturados

Após deploy, validar com os comandos abaixo (admin only) — o LLM deve gerar a `filters` correta:

| Comando do admin | Esperado em `filters` |
|---|---|
| "reduzir 10% de todos os orçamentos em negociação" | `pipeline_stages=['negociacao']` |
| "reduzir 5% nos orçamentos em proposta criados este mês" | `pipeline_stages=['proposta']`, `created_from=YYYY-MM-01`, `created_to=hoje` |
| "estender validade para 60 dias em todos os orçamentos aguardando informação" | `internal_statuses=['waiting_info']`, `validity_days=60` |
| "arquivar todos os leads com mais de 90 dias" | `pipeline_stages=['lead']`, `created_to=hoje-90d` |
| "reduzir 10% em todos os 200+ orçamentos em negociação" | aciona `will_run_in_background=true`, polling de status |

# Smoke test SQL (rodar no Studio Supabase)

```sql
-- Conta quantos orçamentos seriam afetados (sem aplicar)
select public.count_eligible_budgets(
  null::text[],            -- internal_statuses
  ARRAY['negociacao'],     -- pipeline_stages
  null::date, null::date,
  true
);

-- Em ambiente de staging com 250+ orçamentos, dispara o RPC com fator 0.9 (-10%)
-- (use somente em DB de teste!)
-- select * from public.bulk_apply_factor_to_items(
--   ARRAY[<budget_uuid>, ...]::uuid[],
--   0.9
-- );
```
