---
name: AI bulk operations
description: Comandos admin em lote no assistente (preview/diff, confirmar, reverter) via edge function ai-bulk-operations
type: feature
---

Edge function `ai-bulk-operations` planeja e executa operações em lote (financial_adjustment, status_change, etc.) via tool calling Gemini 2.5 Pro.

Para `financial_adjustment`:
1. Clona cada orçamento como nova versão via `cloneBudgetAsNewVersion`.
2. Aplica o factor nas novas versões via RPC `bulk_apply_factor_to_items(p_budget_ids, p_factor)`.
3. Persiste mapping de clones no snapshot para revert.

**Lições aprendidas (correções 2026-04-29):**

1. **Nomes de parâmetros da RPC devem bater exatamente.** Anteriormente o código chamava `{ _budget_ids, _factor }` mas a função SQL declara `p_budget_ids` / `p_factor`. PostgREST falhava silenciosamente → caía no fallback row-a-row → em alta concorrência podia deixar a nova versão idêntica à fonte (sem aplicar a redução).

2. **Guarda anti-regressão silenciosa.** Após o RPC, se `factor != 1` mas `items_updated == 0 && sections_updated == 0`, lança erro fatal — significa que clonamos versões mas nada foi ajustado.

3. **Resolução robusta da fonte do clone.** Em vez de confiar cegamente no `sourceBudgetId` recebido, `cloneBudgetAsNewVersion` consulta o grupo (`version_group_id`) e prefere a versão mais recente com `is_published_version=true`, depois `is_current_version=true`. Isso protege contra grupos com `is_current_version` dessincronizado.
