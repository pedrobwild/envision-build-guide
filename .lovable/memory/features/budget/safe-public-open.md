---
name: Safe public budget open
description: Helper openPublicBudget garante que botão "Visualizar" sempre abre versão acessível ao anônimo, com fallback para versão publicada do mesmo grupo e auto-publish opcional
type: feature
---
Helper `src/lib/openPublicBudget.ts` deve ser usado em TODO botão "Visualizar/Abrir orçamento público" do admin.

Estratégia em ordem:
1. Se o budget atual já está em `published` ou `minuta_solicitada`, abre direto.
2. Senão, busca no `version_group_id` (fallback `id`) a versão publicada mais recente e abre o public_id dela.
3. Se nenhuma versão do grupo está publicada e `autoPublish=true` (default), publica o budget atual e abre.
4. Se `autoPublish=false`, mostra toast pedindo publicação manual.

**Por quê:** o RPC `get_public_budget` (e RLS) só servem `published`/`minuta_solicitada`. Drafts geram "Página não encontrada". Isso protege contra cenários onde a v1 está publicada com valores antigos e a v3 (current) é draft com valores corrigidos — o helper detecta e abre a versão certa.

**Aplicado em:** `BudgetInternalDetail.tsx` (header e drawer). Replicar nos demais pontos de "Visualizar" do admin sempre que adicionar novos.
