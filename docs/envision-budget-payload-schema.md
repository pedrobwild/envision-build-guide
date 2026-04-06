# Envision → Portal BWild: Budget Payload Schema

> Documentação técnica do payload enviado pelo Envision Guide ao Portal BWild
> quando um orçamento é marcado como **Contrato Fechado**.

---

## Endpoint de destino

```
POST {PORTAL_BWILD_SUPABASE_URL}/functions/v1/sync-project-inbound
```

### Headers

| Header              | Valor                          |
|---------------------|--------------------------------|
| `Content-Type`      | `application/json`             |
| `x-integration-key` | Chave compartilhada (secret)   |

---

## Estrutura raiz do payload

```jsonc
{
  "source_id": "uuid",        // ID do orçamento no Envision
  "project": { ... },         // Dados do projeto / cliente
  "budget": { ... }           // Breakdown financeiro completo
}
```

---

## `project` — Dados do projeto

| Campo                        | Tipo     | Descrição                                       |
|------------------------------|----------|-------------------------------------------------|
| `name`                       | string   | Nome do projeto                                 |
| `client_name`                | string   | Nome do cliente                                 |
| `client_phone`               | string?  | Telefone do cliente                             |
| `client_email`               | string?  | E-mail do cliente                               |
| `address`                    | string?  | Endereço formatado (condomínio, bairro, cidade) |
| `condominium`                | string?  | Nome do condomínio                              |
| `neighborhood`               | string?  | Bairro                                          |
| `city`                       | string?  | Cidade                                          |
| `unit`                       | string?  | Unidade / apartamento                           |
| `property_type`              | string   | Tipo do imóvel (ex: "Apartamento")              |
| `total_area`                 | string?  | Metragem do imóvel                              |
| `estimated_duration_weeks`   | number?  | Duração estimada em semanas                     |
| `budget_value`               | number   | Valor total do orçamento                        |
| `budget_code`                | string?  | Código sequencial (ex: "ORC-0042")              |
| `status`                     | string   | Sempre `"planning"` ao criar                    |
| `notes`                      | string?  | Notas internas                                  |
| `consultora_comercial`       | string?  | Nome da consultora comercial                    |
| `contract_file_url`          | string?  | URL pública do contrato assinado                |

---

## `budget` — Breakdown financeiro

### Campos de resumo

| Campo         | Tipo   | Descrição                                      |
|---------------|--------|-------------------------------------------------|
| `total_value` | number | Valor total final (seções + ajustes)            |
| `total_sale`  | number | Soma dos preços de venda das seções             |
| `total_cost`  | number | Soma dos custos internos dos itens              |
| `avg_bdi`     | number | BDI médio percentual                            |
| `net_margin`  | number | Margem líquida (`total_sale - total_cost`)       |

### `budget.sections[]` — Seções do orçamento

| Campo              | Tipo     | Descrição                                  |
|--------------------|----------|--------------------------------------------|
| `id`               | uuid     | ID da seção                                |
| `title`            | string   | Título da seção                            |
| `subtitle`         | string?  | Subtítulo                                  |
| `notes`            | string?  | Notas da seção                             |
| `order_index`      | number   | Ordem de exibição                          |
| `is_optional`      | boolean  | Se é seção opcional                        |
| `section_price`    | number   | Preço de venda da seção                    |
| `cover_image_url`  | string?  | URL da imagem de capa                      |
| `included_bullets` | array    | Lista de itens inclusos (texto)            |
| `excluded_bullets` | array    | Lista de itens não inclusos (texto)        |
| `tags`             | array    | Tags da seção                              |
| `cost`             | number   | Custo interno calculado                    |
| `bdi_percentage`   | number   | BDI percentual da seção                    |
| `item_count`       | number   | Quantidade de itens na seção               |
| `items`            | array    | Lista de itens (ver abaixo)                |

### `budget.sections[].items[]` — Itens do orçamento

| Campo                | Tipo     | Descrição                                           |
|----------------------|----------|-----------------------------------------------------|
| `id`                 | uuid     | ID do item                                          |
| `title`              | string   | Nome/título do item                                 |
| `description`        | string?  | Descrição detalhada                                 |
| `qty`                | number?  | Quantidade                                          |
| `unit`               | string?  | Unidade de medida (m², un, vb, etc.)                |
| `order_index`        | number   | Ordem de exibição                                   |
| `internal_unit_price`| number?  | Preço unitário interno (custo)                      |
| `internal_total`     | number?  | Total interno (custo)                               |
| `bdi_percentage`     | number?  | BDI percentual do item                              |
| `included_rooms`     | array    | Cômodos incluídos                                   |
| `excluded_rooms`     | array    | Cômodos excluídos                                   |
| `coverage_type`      | string   | Tipo de cobertura (`"geral"`, `"por_comodo"`, etc.) |
| `reference_url`      | string?  | URL de referência do produto                        |
| `notes`              | string?  | Notas internas do item                              |
| `catalog_item_id`    | uuid?    | ID do item no catálogo mestre (se vinculado)        |
| **`item_category`**  | string?  | **Categoria: `"produto"` ou `"prestador"`**         |
| **`supplier_id`**    | uuid?    | **ID do fornecedor atribuído**                      |
| **`supplier_name`**  | string?  | **Nome do fornecedor atribuído**                    |

> ⚠️ Os campos `item_category`, `supplier_id` e `supplier_name` são extraídos
> do `catalog_snapshot` do item no Envision. Podem ser `null` se o item foi
> criado manualmente sem vinculação a fornecedor.

### `budget.adjustments[]` — Ajustes financeiros

| Campo    | Tipo   | Descrição                                   |
|----------|--------|---------------------------------------------|
| `id`     | uuid   | ID do ajuste                                |
| `label`  | string | Descrição (ex: "Desconto comercial")        |
| `amount` | number | Valor do ajuste                             |
| `sign`   | number | `1` para acréscimo, `-1` para desconto      |

---

## Exemplo de payload completo

```json
{
  "source_id": "21681497-bbb9-4439-a721-d1c8e2fd0128",
  "project": {
    "name": "Reforma Apt 42 - Vila Olímpia",
    "client_name": "Maria Silva",
    "client_phone": "+5511999887766",
    "client_email": "maria@email.com",
    "address": "Edifício Aurora, Vila Olímpia, São Paulo",
    "condominium": "Edifício Aurora",
    "neighborhood": "Vila Olímpia",
    "city": "São Paulo",
    "unit": "42",
    "property_type": "Apartamento",
    "total_area": "85m²",
    "estimated_duration_weeks": 8,
    "budget_value": 185000,
    "budget_code": "ORC-0042",
    "status": "planning",
    "notes": null,
    "consultora_comercial": "Ana Costa",
    "contract_file_url": "https://...storage.../contratos/contrato-42.pdf"
  },
  "budget": {
    "total_value": 185000,
    "total_sale": 190000,
    "total_cost": 142000,
    "avg_bdi": 33.8,
    "net_margin": 48000,
    "sections": [
      {
        "id": "uuid-section-1",
        "title": "Marcenaria",
        "subtitle": "Cozinha e dormitórios",
        "notes": null,
        "order_index": 0,
        "is_optional": false,
        "section_price": 65000,
        "cover_image_url": null,
        "included_bullets": ["Armários planejados", "Bancada"],
        "excluded_bullets": ["Puxadores importados"],
        "tags": [],
        "cost": 48000,
        "bdi_percentage": 35.4,
        "item_count": 3,
        "items": [
          {
            "id": "uuid-item-1",
            "title": "Armário cozinha superior",
            "description": "MDF branco 18mm",
            "qty": 1,
            "unit": "un",
            "order_index": 0,
            "internal_unit_price": 12000,
            "internal_total": 12000,
            "bdi_percentage": 35,
            "included_rooms": [],
            "excluded_rooms": [],
            "coverage_type": "geral",
            "reference_url": null,
            "notes": null,
            "catalog_item_id": "uuid-catalog-1",
            "item_category": "prestador",
            "supplier_id": "uuid-supplier-1",
            "supplier_name": "Marcenaria São Paulo"
          }
        ]
      }
    ],
    "adjustments": [
      {
        "id": "uuid-adj-1",
        "label": "Desconto comercial",
        "amount": 5000,
        "sign": -1
      }
    ]
  }
}
```

---

## Implementação no Portal BWild

### Colunas sugeridas na tabela `budget_items` do Portal

```sql
-- Adicionar às colunas existentes de budget_items:
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS item_category text,        -- 'produto' | 'prestador'
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid;
```

### Mapeamento no `sync-project-inbound` do Portal

```typescript
// Ao processar cada item do payload:
for (const item of section.items) {
  await supabase.from("budget_items").insert({
    budget_section_id: createdSectionId,
    title: item.title,
    description: item.description,
    qty: item.qty,
    unit: item.unit,
    order_index: item.order_index,
    internal_unit_price: item.internal_unit_price,
    internal_total: item.internal_total,
    bdi_percentage: item.bdi_percentage,
    coverage_type: item.coverage_type,
    // Novos campos de categoria e fornecedor:
    item_category: item.item_category,      // "produto" | "prestador" | null
    supplier_id: item.supplier_id,          // UUID do fornecedor ou null
    supplier_name: item.supplier_name,      // Nome do fornecedor ou null
    catalog_item_id: item.catalog_item_id,  // UUID do catálogo ou null
  });
}
```

### Exibição visual sugerida

- **Badge de categoria**: Azul para `"prestador"`, Cinza para `"produto"`
- **Nome do fornecedor**: Exibir abaixo do título do item como texto secundário
- Itens sem categoria/fornecedor: exibir sem badge (item manual)

---

## Changelog

| Data       | Versão | Alteração                                                  |
|------------|--------|-------------------------------------------------------------|
| 2026-04-06 | 1.0    | Schema inicial com seções, itens e ajustes                  |
| 2026-04-06 | 1.1    | Adicionados `item_category`, `supplier_id`, `supplier_name` e `catalog_item_id` aos itens |
