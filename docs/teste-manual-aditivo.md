# Teste Manual Guiado — Fluxo de Aditivo Contratual

> Objetivo: validar end-to-end o fluxo de aditivo (criar a partir de um orçamento publicado, marcar itens/seções para adicionar/remover, publicar, aprovar via página pública, conferir totais e badges).
>
> Tempo estimado: **15–20 min**.
> Ambiente sugerido: **Preview** ou **Test** (não usar em produção real).

---

## Pré-requisitos

- [ ] Logado como **admin** ou **orçamentista** (somente esses papéis veem a opção “Criar aditivo”).
- [ ] Existe pelo menos **1 orçamento publicado** (status `published` ou `minuta_solicitada`) com:
  - 2+ seções
  - 3+ itens com valores diferentes de zero
  - `public_id` válido (link público funcionando)
- [ ] Anote, antes de começar:
  - **Total atual do orçamento publicado**: R$ ____________
  - **Sequential code (ORC-XXXX)**: ____________
  - **Link público**: ____________

---

## Etapa 1 — Criar o aditivo

1. Abra o orçamento base no editor administrativo (`/admin/orcamento/:id` ou via Pipeline Comercial).
2. Confirme no cabeçalho que o status é **Enviado ao cliente** (ou equivalente publicado).
3. Abra o menu de ações do orçamento e clique em **“Criar aditivo”**.
4. Confirme no diálogo de confirmação.

**Esperado:**
- Toast de sucesso: “Aditivo criado”.
- Redirecionamento automático para o editor da nova versão.
- Banner azul no topo do editor: **“Aditivo Nº 1 · Emendando o orçamento ORC-XXXX — “Nome do Projeto” (vN)”**.
- No `StickyEditorHeader`: badge da versão indica que é uma nova versão (`is_current_version = true`).

**Validação no banco (opcional, via Cloud → Database):**
```sql
SELECT id, sequential_code, is_addendum, addendum_number,
       addendum_base_budget_id, version_number, is_current_version, status
FROM budgets
WHERE addendum_base_budget_id = '<id_do_orcamento_base>'
ORDER BY created_at DESC LIMIT 1;
```
- `is_addendum = true`
- `addendum_number = 1`
- `status = 'draft'`
- `is_current_version = true`

---

## Etapa 2 — Marcar itens para REMOVER

1. Na aba **Planilha**, escolha **2 itens** existentes (herdados do orçamento base).
2. Em cada item, clique no botão pequeno **“−”** (ao lado do item) para marcar como **REMOVER**.

**Esperado:**
- O item ganha **fundo vermelho claro**, badge **REMOVER** e o texto fica riscado.
- O botão muda para **“✓ REM”** (estado ativo).
- Auto-save dispara (chip “Salvo agora” aparece no header).

3. Clique novamente no botão **“✓ REM”** de um deles para desmarcar.

**Esperado:** o item volta ao estado normal e some o badge.

---

## Etapa 3 — Marcar uma seção inteira para REMOVER

1. Em uma seção (que NÃO contém os itens marcados acima), abra o **menu de contexto da seção** (ícone “⋯”).
2. Clique em **“Remover seção (aditivo)”**.

**Esperado:**
- Toda a seção ganha estilo de remoção (fundo vermelho claro + badge **REMOVIDA**).
- Todos os itens dentro da seção entram visualmente como removidos.
- Auto-save persiste a alteração.

---

## Etapa 4 — Adicionar novos itens (somam ao total)

1. Em qualquer seção ativa, clique em **“Adicionar item”**.
2. Preencha **2 itens novos** com valores claros (ex.: R$ 1.000 e R$ 2.500).

**Esperado:**
- Cada novo item exibe badge verde **NOVO** automaticamente.
- Auto-save persiste (`addendum_action = 'add'` no banco).
- O painel financeiro do header recalcula em tempo real.

**Validação no banco (opcional):**
```sql
SELECT i.id, i.title, i.addendum_action, i.internal_total
FROM items i
JOIN sections s ON s.id = i.section_id
WHERE s.budget_id = '<id_do_aditivo>'
ORDER BY i.created_at DESC;
```

---

## Etapa 5 — Conferir cálculo financeiro no editor

1. Olhe o **StickyEditorHeader** (totais).

**Cálculo esperado (manual):**
```
Total final do aditivo = Total base
                       − soma(itens marcados como remove)
                       − soma(itens dentro de seções marcadas como remove)
                       + soma(itens novos com addendum_action = 'add')
```

- [ ] Anote o total exibido: R$ ____________
- [ ] Faça a conta com calculadora a partir dos valores anotados.
- [ ] Os dois valores **devem bater**. Se não baterem → reportar bug.

---

## Etapa 6 — Salvar e Publicar o aditivo

1. Clique em **“Salvar e Publicar”** no canto superior direito.
2. Aguarde o spinner.

**Esperado:**
- Toast: “Aditivo publicado”.
- Status muda para **published**.
- O `public_id` é **transferido** da versão anterior para o aditivo (mesmo link p/ cliente).
- Banner amarelo aparece: “Esta é a versão publicada (visível ao cliente)…”.

**Validação no banco:**
```sql
-- Antes vs depois: o public_id deve estar no aditivo, NÃO mais no original
SELECT id, sequential_code, status, is_published_version, is_current_version, public_id
FROM budgets
WHERE version_group_id = '<version_group_id>'
ORDER BY version_number;
```
- Apenas o aditivo tem `public_id` preenchido.
- `is_published_version = true` e `is_current_version = true` no aditivo.

---

## Etapa 7 — Validar página pública (visão do cliente)

1. Abra o **link público** anotado no início, em uma **aba anônima**.

**Esperado no topo da página:**
- Banner destacado: **“Aditivo Nº 1”** com `addendum_summary` (se preenchido).
- Cabeçalho com nome do projeto.

**Esperado na composição do investimento:**
- [ ] **Itens marcados como REMOVE não aparecem** na lista (ficam escondidos).
- [ ] **Seções marcadas como REMOVE não aparecem**.
- [ ] **Itens novos exibem badge verde NOVO** (em `ProductShowcaseCard`).
- [ ] O **valor total final** exibido corresponde ao calculado na Etapa 5.

**Edge cases a verificar:**
- [ ] Itens opcionais ainda funcionam (simulador de opcionais não quebra).
- [ ] Galeria, Tour 3D e mídias herdadas continuam acessíveis.
- [ ] Não há scroll horizontal em mobile (375 px).

---

## Etapa 8 — Aprovar o aditivo (fluxo do cliente)

1. Na página pública, role até o **CTA de aprovação** (`ApprovalCTA`).
2. Confirme que o botão diz **“Aprovar Aditivo Nº 1”** (e não “Aprovar Orçamento”).
3. Preencha o nome do aprovador e clique em aprovar.

**Esperado:**
- Toast/feedback de sucesso aparece imediatamente.
- A área do CTA passa a mostrar “Aprovado por **Nome** em **dd/mm/yyyy hh:mm**”.
- Recarregando a página, o estado aprovado persiste (não volta para o botão).

**Validação no banco:**
```sql
SELECT id, sequential_code, addendum_approved_at, addendum_approved_by_name, status
FROM budgets
WHERE id = '<id_do_aditivo>';
```
- `addendum_approved_at` preenchido.
- `addendum_approved_by_name` igual ao nome digitado.

---

## Etapa 9 — Conferir histórico e auditoria

1. No editor, abra o **painel de versões** (`VersionHistoryPanel`).
2. Confirme que aparece a entrada **“Aditivo Nº 1”** no topo da timeline.
3. Abra o **Comparador de Versões** (`/admin/orcamento/:id/comparar`).

**Esperado:**
- Diff mostra itens adicionados (verde) e removidos (vermelho).
- Delta financeiro líquido exibido bate com o cálculo manual.

**Auditoria (opcional):**
```sql
SELECT event_type, metadata, created_at
FROM version_audit_log
WHERE budget_id = '<id_do_aditivo>'
ORDER BY created_at DESC;
```
Deve haver eventos `addendum_created` e (após publicar) `version_published`.

---

## Checklist final

- [ ] Etapa 1 — aditivo criado e banner referencia o orçamento original
- [ ] Etapa 2 — itens marcados REMOVE com estilo correto
- [ ] Etapa 3 — seção inteira removível
- [ ] Etapa 4 — itens novos com badge NOVO
- [ ] Etapa 5 — cálculo financeiro bate (manual vs UI)
- [ ] Etapa 6 — publicação transfere `public_id`
- [ ] Etapa 7 — página pública filtra itens removidos e mostra badge NOVO
- [ ] Etapa 8 — aprovação dedicada do aditivo persiste no banco
- [ ] Etapa 9 — histórico/auditoria registra eventos

---

## Troubleshooting rápido

| Sintoma | Causa provável | Onde olhar |
|---|---|---|
| Botão “Criar aditivo” não aparece | Usuário não é admin/orçamentista, ou orçamento não está publicado | `RoleGuard` + `internal_status` |
| Badge NOVO não aparece em item criado no aditivo | `addendum_action` não foi setado no insert | `SectionsEditor.handleAddItem` |
| Item REMOVE ainda aparece na pública | `visibleSections` não filtrou; cache CDN | `PublicBudget.tsx` + hard refresh |
| Total não bate | `calcGrandTotals` não está aplicando subtração | `src/lib/budget-calc.ts` |
| Link público mostra versão antiga | `public_id` não foi transferido na publicação | `publishVersion` em `budget-versioning.ts` |
| Aprovação não persiste | RPC `approve_addendum` falhou (RLS/anon) | Edge logs + policies de `budgets` |

---

## Como reportar um bug encontrado

Use o **Bug Reporter** (botão flutuante no canto da tela) com:
- Etapa em que falhou (ex.: “Etapa 5 — cálculo errado”)
- Valor esperado vs valor exibido
- ID do aditivo e do orçamento base
- Print da tela
