# Envision ↔ Portal BWild — Referência de Integração

## Visão Geral

Integração bidirecional entre **Envision Build Guide** (orçamentos) e **Portal BWild** (gestão de obras) via Supabase Edge Functions + triggers PostgreSQL.

---

## Arquitetura

```
┌──────────────────────┐         ┌──────────────────────┐
│   ENVISION (origem)  │         │  PORTAL BWILD (dest)  │
│                      │         │                       │
│  suppliers ──────────┼── OUT ──┼──▶ fornecedores       │
│  budgets ────────────┼── OUT ──┼──▶ projects            │
│  suppliers ◀─────────┼── IN ───┼── fornecedores        │
│                      │         │                       │
│  integration_sync_log│         │  (log próprio)        │
└──────────────────────┘         └───────────────────────┘
```

---

## Edge Functions

| Função | Direção | Trigger | Descrição |
|--------|---------|---------|-----------|
| `sync-supplier-outbound` | Envision → Portal | Auto (trigger DB) + Manual | Envia/atualiza fornecedor no Portal BWild |
| `sync-supplier-inbound` | Portal → Envision | Webhook (POST externo) | Recebe fornecedor do Portal BWild |
| `sync-project-outbound` | Envision → Portal | Auto (trigger DB) | Cria projeto quando orçamento vira `contrato_fechado` |

---

## 1. Sincronização de Fornecedores (Outbound)

### Trigger Automático
- **Evento**: `INSERT` ou `UPDATE` na tabela `suppliers`
- **Trigger**: `trg_sync_supplier_outbound` → `trigger_sync_supplier_outbound()`
- **Mecanismo**: `pg_net` HTTP POST assíncrono

### Chamada Manual
```bash
POST /functions/v1/sync-supplier-outbound
Content-Type: application/json
Authorization: Bearer <anon_key>

# Fornecedor único
{ "supplier_id": "uuid" }

# Múltiplos
{ "supplier_ids": ["uuid1", "uuid2"] }

# Retentar falhas
{ "action": "retry_failed" }
```

### Mapeamento de Campos

| Envision (`suppliers`) | Portal BWild (`fornecedores`) |
|------------------------|-------------------------------|
| `name` | `nome` |
| `razao_social` | `razao_social` |
| `cnpj_cpf` | `cnpj_cpf` |
| `categoria` | `subcategoria` |
| *(calculado)* | `tipo` ("prestadores" / "produtos") |
| `endereco` | `endereco` |
| `cidade` | `cidade` |
| `estado` | `estado` |
| `email` | `email` |
| `telefone` | `telefone` |
| `site` | `site` |
| `condicoes_pagamento` | `condicoes_pagamento` |
| `prazo_entrega_dias` | `prazo_entrega_dias` |
| `produtos_servicos` | `produtos_servicos` |
| `nota` | `nota` |
| `observacoes` | `observacoes` |
| `is_active` | `is_active` |
| `contact_info` | `contato` |
| `id` | `external_id` |
| — | `external_system` = "envision" |

### Classificação Automática de Tipo

O campo `tipo` é determinado pela `categoria` do fornecedor:

**Prestadores**: marcenaria, serralheria, gesso, pintura, elétrica, hidráulica, ar condicionado, automação, impermeabilização, mão de obra, instalação, projeto, demolição

**Produtos**: todo o restante

---

## 2. Sincronização de Fornecedores (Inbound)

### Endpoint
```bash
POST /functions/v1/sync-supplier-inbound
Content-Type: application/json
x-integration-key: <INTEGRATION_INBOUND_KEY>

# Fornecedor único
{
  "fornecedor": { "nome": "...", "cnpj_cpf": "...", ... },
  "source_id": "uuid-do-portal"
}

# Batch
{
  "fornecedores": [
    { "id": "uuid1", "nome": "...", ... },
    { "id": "uuid2", "nome": "...", ... }
  ]
}
```

### Autenticação
- Header `x-integration-key` validado contra o secret `INTEGRATION_INBOUND_KEY`
- **Não usa JWT** — comunicação sistema-a-sistema

### Mapeamento (inverso do outbound)

| Portal BWild (`fornecedores`) | Envision (`suppliers`) |
|-------------------------------|------------------------|
| `nome` / `name` | `name` |
| `razao_social` | `razao_social` |
| `cnpj_cpf` | `cnpj_cpf` |
| `subcategoria` / `categoria` | `categoria` |
| `endereco` | `endereco` |
| `cidade` | `cidade` |
| `estado` | `estado` |
| `email` | `email` |
| `telefone` | `telefone` |
| `site` | `site` |
| `condicoes_pagamento` | `condicoes_pagamento` |
| `prazo_entrega_dias` | `prazo_entrega_dias` |
| `produtos_servicos` | `produtos_servicos` |
| `nota` | `nota` |
| `observacoes` | `observacoes` |
| `contato` | `contact_info` |
| `is_active` | `is_active` |
| `source_id` | `external_id` |
| — | `external_system` = "portal_bwild" |

---

## 3. Criação de Projeto (contrato_fechado)

### Trigger Automático
- **Evento**: `UPDATE` na tabela `budgets` onde `internal_status` muda para `contrato_fechado`
- **Trigger**: `trg_sync_project_on_contrato` → `trigger_sync_project_on_contrato()`
- **Proteção**: Não dispara se já existe sync com `status = success` para o budget

### Chamada Manual
```bash
POST /functions/v1/sync-project-outbound
Content-Type: application/json
Authorization: Bearer <anon_key>

{ "budget_id": "uuid" }
```

### Mapeamento de Campos

| Envision (`budgets`) | Portal BWild (`projects`) |
|----------------------|---------------------------|
| `project_name` | `name` |
| `client_name` | `client_name` |
| `client_phone` | `client_phone` |
| `lead_email` | `client_email` |
| `condominio + bairro + city` | `address` |
| `condominio` | `condominium` |
| `bairro` | `neighborhood` |
| `city` | `city` |
| `unit` | `unit` |
| `property_type` | `property_type` |
| `metragem` | `total_area` |
| `estimated_weeks` | `estimated_duration_weeks` |
| *(calculado)* | `budget_value` |
| `sequential_code` | `budget_code` |
| `internal_notes` | `notes` |
| `consultora_comercial` | `consultora_comercial` |
| — | `status` = "planning" |
| `id` | `external_id` |
| — | `external_system` = "envision" |

### Cálculo do Valor Total
```
total = Σ section_price (seções não-opcionais) + Σ (amount × sign) dos adjustments
```

---

## Tabela de Controle: `integration_sync_log`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | PK |
| `source_system` | text | "envision" ou "portal_bwild" |
| `target_system` | text | "portal_bwild" ou "envision" |
| `entity_type` | text | "supplier" ou "project" |
| `source_id` | UUID | ID no sistema de origem |
| `target_id` | UUID | ID criado no destino |
| `sync_status` | text | "pending", "success", "failed", "skipped" |
| `payload` | JSONB | Dados enviados |
| `error_message` | text | Mensagem de erro (se falhou) |
| `attempts` | int | Número de tentativas |
| `synced_at` | timestamptz | Última sincronização |

**Constraint UNIQUE**: `(source_system, entity_type, source_id)` — evita duplicatas.

---

## Colunas de Vínculo Externo

### `suppliers`
- `external_id` (UUID) — ID do fornecedor no sistema remoto
- `external_system` (text) — "portal_bwild" ou "envision"

### Portal BWild `fornecedores` / `projects`
- `external_id` — ID do registro no Envision
- `external_system` — "envision"

---

## Secrets Necessários

| Secret | Onde | Descrição |
|--------|------|-----------|
| `PORTAL_BWILD_SUPABASE_URL` | Envision | URL do projeto Portal BWild |
| `PORTAL_BWILD_SERVICE_ROLE_KEY` | Envision | Service Role Key do Portal BWild |
| `INTEGRATION_INBOUND_KEY` | Envision | Chave para autenticar chamadas inbound |
| `SUPABASE_URL` | Vault (auto) | URL do próprio projeto (para triggers) |
| `SUPABASE_ANON_KEY` | Vault (auto) | Anon key (para triggers) |

---

## Configuração no Portal BWild (Sistema Destino)

Para completar a integração, o Portal BWild precisa:

1. **Tabela `fornecedores`** com colunas `external_id` e `external_system`
2. **Tabela `projects`** com colunas `external_id` e `external_system`
3. **Edge function equivalente** para enviar fornecedores de volta (inbound no Envision)
4. **Secret `INTEGRATION_INBOUND_KEY`** com o mesmo valor configurado no Envision

---

## Monitoramento

- **UI**: Página Sistema → Painel "Monitor de Integração"
- **KPIs**: Total, Sucesso, Falhas, Pendentes
- **Ações**: Retentar falhas, refresh manual
- **Auto-refresh**: A cada 30 segundos
- **Botão manual**: Ícone ↔ na lista de fornecedores (Catálogo → Fornecedores)

---

## Fluxo de Retry

O outbound aceita `{ "action": "retry_failed" }` que:
1. Busca todos os registros em `integration_sync_log` com `sync_status = 'failed'` e `attempts < 5`
2. Re-executa a sincronização de cada um
3. Atualiza o log com o novo resultado

---

## Tratamento de Erros

- Erros são logados em `integration_sync_log` com `error_message`
- O contador `attempts` incrementa a cada tentativa
- Após 5 tentativas falhas, o registro não é mais incluído no retry automático
- Triggers usam `RAISE WARNING` em caso de secrets ausentes (não bloqueiam a operação principal)
