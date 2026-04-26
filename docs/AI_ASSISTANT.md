# Assistente BWild — Inteligência de Dados + Mercado

O Assistente BWild combina **dados internos da plataforma** (Supabase) com **pesquisa de mercado em tempo real** (Perplexity) para responder qualquer pergunta de negócio em pt-BR.

Edge function: `supabase/functions/ai-assistant-chat/index.ts`
UI: `src/components/AiAssistant.tsx`

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  AiAssistant.tsx (Sheet flutuante, streaming SSE)           │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /functions/v1/ai-assistant-chat
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ai-assistant-chat (Deno)                                   │
│   1. Auth + papel (admin ⇒ tools liberadas)                 │
│   2. Anexos: PDF / DOCX / XLSX / áudio (Whisper) / imagem   │
│   3. OpenAI gpt-4o (admin/anexos) ou gpt-4o-mini            │
│   4. Loop tool-calling (até 4 rodadas)                      │
│   5. Stream SSE da resposta final                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┬─────────────────┐
        ▼                  ▼                  ▼                 ▼
┌──────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐
│query_analytics│ │get_kpi_trend  │  │top_entities   │  │web_market_  │
│multi-tabela  │  │snapshot diário│  │rankings       │  │research     │
│agregada      │  │(rápido)       │  │prontos        │  │(Perplexity) │
└──────────────┘  └───────────────┘  └───────────────┘  └─────────────┘
        │                  │                  │                 │
        └─────── Supabase (RLS + service role) ─────────┘  api.perplexity.ai
```

## Tools

### `query_analytics`
Agregação multi-tabela em tempo real.

| Tabela | Campos de data | Métricas | Group_by recomendados |
|---|---|---|---|
| `budgets` | created_at, approved_at, closed_at, due_at | count, sum_internal_cost, avg_internal_cost, sum_manual_total | day, week, month, internal_status, pipeline_stage, commercial_owner, lead_source |
| `clients` | created_at, updated_at | count | day, status, source, city, bairro |
| `lead_sources` | received_at, processed_at | count | day, source, campaign_name, form_name, processing_status |
| `items` | created_at | count, sum_internal_total, avg_internal_total, sum_qty | day, month |
| `suppliers` | created_at | count | none |
| `catalog_items` | created_at | count | category_id |
| `catalog_price_history` | created_at | count | supplier_id |

**Exemplos de perguntas:**
- *"Média de orçamentos por dia nos últimos 7 dias"* → `table=budgets, metric=count, group_by=day, days=7`
- *"Leads por origem em abril"* → `table=lead_sources, metric=count, group_by=source, days=30`
- *"Novos clientes por bairro"* → `table=clients, metric=count, group_by=bairro, days=90`

Limites: 5000 linhas por consulta, cache LRU de 60s.

### `get_kpi_trend`
Lê `daily_metrics_snapshot` (já calculado pelo cron `snapshot-daily-metrics`). Muito mais rápido que recalcular de `budgets`.

KPIs: `received_count`, `backlog_count`, `overdue_count`, `closed_count`, `sla_on_time_pct`, `avg_lead_time_days`, `conversion_rate_pct`, `avg_ticket_brl`, `revenue_brl`, etc.

### `top_entities`
Rankings prontos:
- `clients_by_revenue` — top clientes por receita (contratos fechados)
- `clients_by_budget_count` — top clientes por nº de contratos
- `suppliers_by_item_count` — top fornecedores por nº de itens cadastrados
- `campaigns_by_leads` — top campanhas (Meta/Google) por leads
- `lost_reasons` — motivos de perda mais comuns

### `web_market_research`
Wrapper sobre `api.perplexity.ai` (sonar-pro). Modos:
- `benchmarking` — comparar concorrentes (Houzz, Buildertrend, CoConstruct, Procore, Sienge, Obra Prima)
- `references` — tendências e melhores práticas
- `ux` — análise de UX/UI
- `general` — pesquisa geral

Retorna `content` + `citations` (URLs).

## Variáveis de ambiente exigidas

| Var | Onde |
|---|---|
| `OPENAI_API_KEY` | Edge function (já configurada) |
| `PERPLEXITY_API_KEY` | Edge function (já configurada para `perplexity-search`) |
| `SUPABASE_URL` | auto |
| `SUPABASE_SERVICE_ROLE_KEY` | auto |

## Segurança

1. **RBAC duplo**: a UI esconde tools de não-admins; a edge function revalida o papel antes de executar qualquer tool de dados.
2. **Service-role apenas no servidor**: nunca exposto ao cliente.
3. **Read-only**: nenhuma tool faz INSERT/UPDATE/DELETE.
4. **Whitelist de tabelas e métricas**: `TABLE_CONFIG` define exatamente o que pode ser consultado.
5. **Limite de 5000 linhas** por chamada e timeout implícito do Edge Runtime.

## Perguntas que o assistente responde bem

**Operacionais (admin):**
- "Qual a média de orçamentos por dia nos últimos 7 dias?"
- "Quantos contratos foram fechados este mês?"
- "Top 5 comerciais por publicações no trimestre"
- "Backlog atual vs. há 30 dias"
- "Taxa de conversão da última semana"
- "Receita acumulada em abril"
- "Top 10 clientes por receita nos últimos 90 dias"
- "Quantos leads do Meta Ads na última semana?"
- "Quais os motivos de perda mais comuns?"

**Mercado/concorrência (todos):**
- "Como o Houzz monetiza?"
- "Tendências de software de gestão de obras em 2026"
- "Como o Buildertrend mostra orçamento ao cliente final?"
- "Compare features de Procore vs. Sienge"
- "Boas práticas de pricing para SaaS de construção"

**Híbridas:**
- "Nossa taxa de conversão (8%) está abaixo da média do mercado?" → chama `get_kpi_trend` + `web_market_research`
- "Comparar nosso ticket médio com benchmarks de mercado"

**Análise de arquivos:**
- Anexar PDF de orçamento concorrente → resumo + comparativo
- Anexar planilha Excel → análise + insights
- Anexar foto de obra → análise visual

## Como adicionar uma nova tool

1. Defina o schema da tool em `index.ts` (objeto `*_TOOL`).
2. Implemente a função `runMinhaTool(args, admin)`.
3. Adicione ao array `tools` no handler principal.
4. Adicione um branch no `for (const call of toolCalls)`.
5. Documente os exemplos no SYSTEM_PROMPT.

## Como adicionar uma nova tabela ao `query_analytics`

Adicione uma entrada em `TABLE_CONFIG` com:
- `selectFields` — colunas necessárias
- `defaultDateField` — campo de data padrão
- `numericFieldByMetric` — mapa de qual coluna usar para cada métrica

Adicione o nome ao `enum` da propriedade `table` da tool.
