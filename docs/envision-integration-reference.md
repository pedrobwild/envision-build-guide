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

| Função | Direção | Trigger | Endpoint Destino |
|--------|---------|---------|-----------------|
| `sync-supplier-outbound` | Envision → Portal | Auto (trigger DB) + Manual | `POST {PORTAL_BWILD_URL}/functions/v1/sync-supplier-inbound` |
| `sync-suppliers-inbound` (plural) | Portal → Envision | Webhook (POST externo do Portal) | *(recebe no Envision — formato achatado)* |
| `sync-supplier-inbound` (singular, legado) | Portal → Envision | Webhook (POST externo) | *(recebe no Envision — wrapper `{ fornecedor, source_id }`)* |
| `sync-project-outbound` | Envision → Portal | Auto (trigger DB on contrato_fechado) | `POST {PORTAL_BWILD_URL}/functions/v1/sync-project-inbound` |

> ⚠️ **Atenção ao naming:** o Portal BWild (`relatorio-carlos`) chama o endpoint **plural** `sync-suppliers-inbound` no Envision, com payload achatado (campos no nível raiz, sem wrapper). O endpoint singular `sync-supplier-inbound` permanece para compatibilidade com chamadas antigas ou de teste que enviem `{ fornecedor: {...}, source_id }`.

### Protocolo de Comunicação
- **Outbound**: HTTP POST direto para edge function do sistema destino
- **Autenticação**: Header `x-integration-key` com chave compartilhada (`INTEGRATION_INBOUND_KEY`)
- **Não usa Service Role Key** do destino — toda autenticação é via API key

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

### Endpoint **plural** (usado pelo Portal BWild em produção)

O `sync-suppliers-outbound` do Portal envia 1 fornecedor por chamada com o
payload **achatado** (campos no nível raiz, sem wrapper):

```bash
POST /functions/v1/sync-suppliers-inbound
Content-Type: application/json
x-integration-key: <INTEGRATION_INBOUND_KEY>

{
  "name": "Marcenaria São Paulo",
  "razao_social": "Marcenaria SP Ltda",
  "cnpj_cpf": "12.345.678/0001-90",
  "categoria": "Prestadores",
  "supplier_subcategory": "Marcenaria",
  "endereco": "Rua X, 100",
  "cidade": "São Paulo",
  "estado": "SP",
  "email": "contato@marcenariasp.com",
  "telefone": "+5511999998888",
  "site": "https://marcenariasp.com",
  "condicoes_pagamento": "30/60",
  "prazo_entrega_dias": 30,
  "produtos_servicos": "Marcenaria sob medida",
  "nota": 5,
  "is_active": true,
  "_source_system": "portal_bwild",
  "_source_id": "<uuid-do-fornecedor-no-portal>"
}
```

**Resposta esperada pelo Portal:**
```json
{ "success": true, "target_id": "<uuid-do-supplier-no-envision>" }
```

O endpoint plural também aceita batch (`{ "fornecedores": [...] }` ou
`{ "suppliers": [...] }`) e nesse caso responde com `{ "results": [...] }`.

### Endpoint **singular** (legado / wrapper)

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
| — | `status` = `"draft"` (sempre — Portal sobrescreve qualquer valor enviado) |
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
| `PORTAL_BWILD_SUPABASE_URL` | Envision | URL do projeto Portal BWild (usado pelos outbounds para montar `${PORTAL}/functions/v1/sync-*-inbound`) |
| `INTEGRATION_INBOUND_KEY` | Envision | Chave compartilhada — usada como `x-integration-key` nos outbounds e validada nos inbounds. **Deve ser igual** ao `INTEGRATION_API_KEY` configurado no Portal BWild |
| `SUPABASE_URL` | Vault (auto) | URL do próprio projeto (para triggers) |
| `SUPABASE_ANON_KEY` | Vault (auto) | Anon key (para triggers) |

> **Nota sobre o Portal BWild:** o Portal valida a mesma chave compartilhada
> sob o nome `INTEGRATION_API_KEY` (e não `INTEGRATION_INBOUND_KEY`). O valor
> precisa ser idêntico nos dois lados.

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
