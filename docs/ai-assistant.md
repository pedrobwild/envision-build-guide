# Assistente de IA BWild

Copiloto conversacional integrado ao sistema que responde perguntas complexas
sobre **dados internos** (orçamentos, CRM, operações, financeiro) e **mercado**
(tendências, concorrentes, preços externos), com raciocínio avançado e
tool-calling.

## Arquitetura

```
┌────────────────────────┐   SSE   ┌───────────────────────────┐
│  React (AssistantPanel)│ ──────▶ │ edge: ai-assistant (Deno) │
└────────────────────────┘         └────────────┬──────────────┘
                                                │ tool calls
                  ┌─────────────────────────────┼──────────────────────────────┐
                  ▼                             ▼                              ▼
        Supabase (RLS)              edge: perplexity-search           pgvector (ai_embeddings)
        budgets / clients /         (inteligência de mercado)          via ai_match_embeddings()
        catalog_items / user_roles
```

- **LLM**: OpenAI `chat.completions` com `tools` (function calling) em streaming.
  Modelo configurável pela env `AI_MODEL` (padrão `gpt-4o-mini`).
- **Mercado**: usa a edge function existente `perplexity-search`.
- **RAG**: pgvector (tabela `ai_embeddings`, RPC `ai_match_embeddings`).
- **Persistência**: `ai_conversations` + `ai_messages` com RLS por usuário.

## Tools disponíveis para o agente

| Tool                    | Fonte                  | Descrição                                             |
| ----------------------- | ---------------------- | ----------------------------------------------------- |
| `query_budgets`         | `budgets`              | Lista/filtra orçamentos por status, cliente, período. |
| `query_clients`         | `clients`              | Busca CRM por nome, telefone, e-mail.                 |
| `get_operations_metrics`| RPC `ai_operations_summary` | KPIs consolidados (aprovados, pendentes, receita). |
| `search_catalog`        | `catalog_items`        | Pesquisa de materiais/serviços.                       |
| `semantic_search`       | `ai_embeddings` + RAG  | Busca semântica no conhecimento indexado.             |
| `search_market`         | `perplexity-search`    | Pesquisa de mercado com citações.                     |

## Rotas e UI

- Botão flutuante global em todo `AdminLayout` (atalho **⌘J / Ctrl+J**).
- Painel lateral (`AssistantPanel`) com chat em streaming e linha do tempo de tools.
- Página dedicada `/admin/assistente` (`AssistantPage`) com histórico.

## Deploy

1. **Aplicar migração**
   ```bash
   supabase db push
   ```
2. **Configurar secrets**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   # (PERPLEXITY_API_KEY já está configurado)
   ```
3. **Deploy das funções**
   ```bash
   supabase functions deploy ai-assistant
   supabase functions deploy ai-embed
   ```
4. **(Opcional) Indexar base**
   ```bash
   curl -X POST https://<project>.supabase.co/functions/v1/ai-embed \
        -H "Authorization: Bearer <admin-jwt>" \
        -H "Content-Type: application/json" \
        -d '{"mode":"full"}'
   ```

## Roles permitidas

`admin`, `comercial`, `orcamentista` — validado no backend e no RoleGuard da rota.

## Próximos passos sugeridos

- Indexar templates de orçamento, notas de clientes e insights semanais.
- Adicionar tool para **Statista/CB Insights** (já há conectores MCP disponíveis).
- Feedback 👍/👎 por resposta para fine-tuning posterior.
- Ações sugeridas (criar orçamento, agendar, enviar WhatsApp) via tools de escrita.
