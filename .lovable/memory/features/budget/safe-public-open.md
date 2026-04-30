---
name: Safe public budget open
description: Helpers openPublicBudget e openPublicBudgetByPublicId garantem que qualquer botão "Visualizar" abra a versão publicada do grupo, com fallback automático e RPC resolve_published_public_id no PublicBudget.tsx
type: feature
---
**Dois helpers** em `src/lib/openPublicBudget.ts`:

1. `openPublicBudget(budget, opts)` — quando o caller já tem o objeto budget completo (id, public_id, status, version_group_id). Estratégia:
   - Se `status` ∈ {published, minuta_solicitada} → abre direto.
   - Senão, busca no `version_group_id` (fallback `id`) a versão publicada mais recente do grupo e abre o public_id dela.
   - Se nada publicado e `autoPublish=true` (default), publica o budget atual e abre.
   - Se `autoPublish=false`, mostra toast.

2. `openPublicBudgetByPublicId(publicId)` — quando o caller só tem o `public_id` (cards de kanban, listas, header do editor). Chama RPC `resolve_published_public_id(p_public_id)` para mapear para o public_id da versão publicada mais recente do mesmo `version_group_id`. Se RPC falhar, abre o link original como fallback.

**Aplicado em** (use sempre uma das duas funções, NUNCA `window.open(getPublicBudgetUrl(...))` direto para abertura):
- `BudgetInternalDetail.tsx` (header e drawer) → `openPublicBudget`
- `StickyEditorHeader.tsx` → `openPublicBudgetByPublicId`
- `KanbanBoard.tsx`, `EstimatorListView.tsx`, `CompactKanbanCard.tsx`, `BudgetActionsMenu.tsx`, `BudgetListCard.tsx` → `openPublicBudgetByPublicId`

**Camada de defesa adicional:** `PublicBudget.tsx` também chama `resolve_published_public_id` quando `get_public_budget` retorna null e faz `window.location.replace('/o/' + resolved)` preservando query/hash. Isso protege links antigos copiados/compartilhados.

**Por quê:** o RPC `get_public_budget` (e RLS) só servem `published`/`minuta_solicitada`. Drafts geram "Página não encontrada". Cobre cenários onde a v1/v2 está publicada com valores antigos e a v5 (current) é draft com valores novos — o sistema redireciona para a versão publicada mais recente. Para cópia de link, manter `getPublicBudgetUrl` direto (o redirect server-side cuida).
