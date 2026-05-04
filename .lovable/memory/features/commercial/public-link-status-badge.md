---
name: Public link status badge
description: Indicador visual no card do Kanban comercial mostrando se o link público está pronto, em rascunho ou ausente — reduz cliques que parecem "quebrados"
type: feature
---

# Public link status badge

Componente `PublicLinkStatusBadge` (`src/components/admin/PublicLinkStatusBadge.tsx`) renderizado na coluna direita do `CompactKanbanCard`, ao lado do `VersionBadge`.

## Estados (derivados de publicId + budget.status)

- **published** (verde, `Eye`): publicId existe e status ∈ `{published, minuta_solicitada}` → clicar em Visualizar abre direto.
- **draft** (âmbar, `EyeOff` + dot pulsante): publicId existe mas status é draft → o handler `openPublicBudgetByPublicId` vai resolver via RPC + fallback (camada 2) para a versão publicada do grupo. Tooltip avisa o que vai acontecer.
- **missing** (cinza, oculto por padrão): sem publicId. Renderiza só com `showMissing`.

## Por que existe

Antes, o usuário clicava no botão Eye e (em raros casos) caía em 404 ou a janela parecia bloqueada sem feedback. O badge antecipa o estado e o handler emite telemetria estruturada (`OpenBudgetTrace`, `window.__openBudgetDiag`) com toast que tem botão "Ver detalhes" → console.table.

## Onde está plugado

- `src/components/admin/CompactKanbanCard.tsx` — recebe `budgetStatus` (status bruto do orçamento, distinto de `internalStatus`).
- `src/components/commercial/KanbanBoard.tsx` — passa `budgetStatus={b.status}` nas duas instâncias do card (kanban e modo lista).

## Tokens

Usa `bg-success/10 text-success`, `bg-warning/10 text-warning`, `bg-muted/60 text-muted-foreground` — tudo via design tokens, sem cores soltas.
