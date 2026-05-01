/**
 * Catálogo de dados que o AI Data Analysis Assistant entende.
 *
 * Cada entidade lista seus campos principais, tipos, significado de negócio
 * e relações. Use este catálogo para:
 *  - Apresentar ao usuário "o que posso analisar".
 *  - Ajudar o NL planner a inferir entidade/campo a partir da pergunta.
 *  - Validar quais métricas são possíveis dado o que temos no banco.
 *
 * IMPORTANTE: este arquivo é a fonte da verdade da camada de IA. Ao adicionar
 * uma nova tabela ou novo campo relevante, atualize aqui. NÃO inventar nomes
 * de tabelas/campos que não existam no Supabase — confirme em
 * `src/integrations/supabase/types.ts` antes.
 */

import type { EntityDefinition, EntityKey } from "./types";

const BUDGETS: EntityDefinition = {
  key: "budgets",
  name: "Orçamentos",
  domain: "operacional",
  description:
    "Registro principal de propostas de obra — desde o lead até o contrato fechado. Acompanha valor interno, custo, status e responsável.",
  defaultDateField: "created_at",
  primaryLabel: "project_name",
  reliability: "high",
  knownLimitations: [
    "Custo interno (`internal_cost`) pode estar ausente em orçamentos antigos.",
    "`closed_at` pode ser nulo até o status ir para `contrato_fechado`.",
    "`expected_close_at` é opcional — usado pelo forecast quando presente.",
  ],
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Identificador único do orçamento.", source: "budgets.id" },
    { name: "project_name", kind: "string", label: "Projeto", meaning: "Nome curto do projeto/obra.", source: "budgets.project_name" },
    { name: "client_id", kind: "id", label: "Cliente", meaning: "Cliente vinculado ao orçamento.", source: "budgets.client_id" },
    { name: "client_name", kind: "string", label: "Nome do cliente", meaning: "Nome do cliente (denormalizado).", source: "budgets.client_name" },
    {
      name: "internal_status",
      kind: "enum",
      label: "Status interno",
      meaning: "Etapa atual no pipeline operacional/comercial.",
      source: "budgets.internal_status",
      enumValues: [
        "mql", "qualificacao", "lead", "validacao_briefing", "novo", "requested",
        "triage", "assigned", "in_progress", "waiting_info", "ready_for_review",
        "delivered_to_sales", "sent_to_client", "revision_requested",
        "minuta_solicitada", "contrato_fechado", "lost", "archived",
      ],
      aggregatable: true,
      reliability: "high",
    },
    { name: "status", kind: "enum", label: "Status público", meaning: "Visibilidade pública do orçamento (draft/published).", source: "budgets.status" },
    { name: "priority", kind: "enum", label: "Prioridade", meaning: "Prioridade declarada (baixa/normal/alta/urgente).", source: "budgets.priority" },
    { name: "internal_cost", kind: "currency_brl", label: "Custo interno", meaning: "Custo total estimado da obra (BRL). Base para margem.", source: "budgets.internal_cost", aggregatable: true, reliability: "medium" },
    { name: "manual_total", kind: "currency_brl", label: "Total manual", meaning: "Total ajustado manualmente. Usado se presente.", source: "budgets.manual_total", aggregatable: true },
    { name: "estimator_owner_id", kind: "id", label: "Orçamentista", meaning: "Responsável técnico pelo orçamento.", source: "budgets.estimator_owner_id" },
    { name: "commercial_owner_id", kind: "id", label: "Comercial", meaning: "Responsável comercial.", source: "budgets.commercial_owner_id" },
    { name: "lead_source", kind: "enum", label: "Origem do lead", meaning: "Origem que gerou esse orçamento.", source: "budgets.lead_source", aggregatable: true },
    { name: "due_at", kind: "datetime", label: "Prazo", meaning: "Prazo de entrega ao comercial.", source: "budgets.due_at", reliability: "high" },
    { name: "expected_close_at", kind: "datetime", label: "Fechamento esperado", meaning: "Data estimada para fechar contrato (forecast).", source: "budgets.expected_close_at" },
    { name: "closed_at", kind: "datetime", label: "Fechado em", meaning: "Quando o contrato foi efetivamente fechado.", source: "budgets.closed_at" },
    { name: "created_at", kind: "datetime", label: "Criado em", meaning: "Data de criação do orçamento.", source: "budgets.created_at" },
    { name: "updated_at", kind: "datetime", label: "Atualizado em", meaning: "Última atualização.", source: "budgets.updated_at" },
    { name: "city", kind: "string", label: "Cidade", meaning: "Cidade do imóvel da obra.", source: "budgets.city", aggregatable: true },
    { name: "bairro", kind: "string", label: "Bairro", meaning: "Bairro do imóvel.", source: "budgets.bairro", aggregatable: true },
    { name: "property_type", kind: "string", label: "Tipo de imóvel", meaning: "Apartamento, casa, cobertura etc.", source: "budgets.property_type", aggregatable: true },
    { name: "view_count", kind: "integer", label: "Visualizações", meaning: "Número de visualizações da página pública pelo cliente.", source: "budgets.view_count", aggregatable: true },
    { name: "is_addendum", kind: "boolean", label: "É aditivo?", meaning: "Indica se é um aditivo de outro orçamento.", source: "budgets.is_addendum" },
  ],
  relations: [
    { to: "clients", via: "client_id", cardinality: "N-1", description: "Cada orçamento pertence a um cliente." },
    { to: "budget_events", via: "id ← budget_events.budget_id", cardinality: "1-N", description: "Histórico de mudanças de status." },
    { to: "budget_lost_reasons", via: "id ← budget_lost_reasons.budget_id", cardinality: "1-N", description: "Motivos de perda quando lost." },
    { to: "budget_activities", via: "id ← budget_activities.budget_id", cardinality: "1-N", description: "Atividades agendadas/executadas." },
    { to: "deal_pipelines", via: "pipeline_id", cardinality: "N-1", description: "Pipeline comercial em que o orçamento está." },
  ],
};

const CLIENTS: EntityDefinition = {
  key: "clients",
  name: "Clientes / Leads",
  domain: "comercial",
  description: "Cadastro unificado de clientes e leads. Origem, dono comercial, dados de contato e localização.",
  defaultDateField: "created_at",
  primaryLabel: "name",
  reliability: "high",
  knownLimitations: [
    "Status (`mql`/`lead`/`cliente`) é parcialmente derivado do estágio do orçamento mais recente.",
    "Campos UTM podem estar vazios para leads inseridos manualmente.",
  ],
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Identificador.", source: "clients.id" },
    { name: "name", kind: "string", label: "Nome", meaning: "Nome do cliente.", source: "clients.name" },
    { name: "status", kind: "enum", label: "Status", meaning: "Lead, MQL ou cliente fechado.", source: "clients.status", enumValues: ["lead", "mql", "cliente"], aggregatable: true },
    { name: "source", kind: "string", label: "Origem", meaning: "Origem do contato (instagram, google, indicacao...).", source: "clients.source", aggregatable: true },
    { name: "commercial_owner_id", kind: "id", label: "Comercial", meaning: "Responsável comercial.", source: "clients.commercial_owner_id" },
    { name: "city", kind: "string", label: "Cidade", meaning: "Cidade do cliente.", source: "clients.city", aggregatable: true },
    { name: "property_city", kind: "string", label: "Cidade do imóvel", meaning: "Cidade do imóvel principal.", source: "clients.property_city", aggregatable: true },
    { name: "tags", kind: "json", label: "Tags", meaning: "Tags livres atribuídas pelo time comercial.", source: "clients.tags" },
    { name: "utm_source", kind: "string", label: "UTM source", meaning: "Origem de tráfego (UTM).", source: "clients.utm_source", aggregatable: true },
    { name: "utm_campaign", kind: "string", label: "UTM campaign", meaning: "Campanha de marketing.", source: "clients.utm_campaign", aggregatable: true },
    { name: "created_at", kind: "datetime", label: "Criado em", meaning: "Data de criação do cadastro.", source: "clients.created_at" },
  ],
  relations: [
    { to: "budgets", via: "id ← budgets.client_id", cardinality: "1-N", description: "Cliente pode ter vários orçamentos." },
    { to: "lead_sources", via: "id ← lead_sources.client_id", cardinality: "1-N", description: "Eventos de captura de lead." },
  ],
};

const LEAD_SOURCES: EntityDefinition = {
  key: "lead_sources",
  name: "Origens de Lead",
  domain: "leads",
  description: "Eventos brutos de captura de lead vindos de integrações (Meta Ads, HubSpot, Site, manuais).",
  defaultDateField: "received_at",
  reliability: "medium",
  knownLimitations: [
    "Pode haver leads não processados (`processing_status != 'processed'`) — exclua-os ao calcular conversão real.",
  ],
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Evento de lead.", source: "lead_sources.id" },
    { name: "source", kind: "string", label: "Fonte", meaning: "Plataforma/canal de origem.", source: "lead_sources.source", aggregatable: true },
    { name: "client_id", kind: "id", label: "Cliente", meaning: "Cliente associado, se já reconciliado.", source: "lead_sources.client_id" },
    { name: "budget_id", kind: "id", label: "Orçamento", meaning: "Orçamento associado, se já gerado.", source: "lead_sources.budget_id" },
    { name: "received_at", kind: "datetime", label: "Recebido em", meaning: "Quando o lead chegou.", source: "lead_sources.received_at" },
    { name: "processed_at", kind: "datetime", label: "Processado em", meaning: "Quando foi processado pelo sistema.", source: "lead_sources.processed_at" },
    { name: "processing_status", kind: "enum", label: "Status", meaning: "Pending, processed, failed.", source: "lead_sources.processing_status", aggregatable: true },
    { name: "campaign_name", kind: "string", label: "Campanha", meaning: "Campanha de origem.", source: "lead_sources.campaign_name", aggregatable: true },
  ],
};

const BUDGET_EVENTS: EntityDefinition = {
  key: "budget_events",
  name: "Eventos de Orçamento",
  domain: "operacional",
  description: "Audit trail de mudanças de status e ações nos orçamentos. Base para lead time e tempo em estágio.",
  defaultDateField: "created_at",
  reliability: "high",
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Evento.", source: "budget_events.id" },
    { name: "budget_id", kind: "id", label: "Orçamento", meaning: "Orçamento alvo do evento.", source: "budget_events.budget_id" },
    { name: "event_type", kind: "string", label: "Tipo", meaning: "Ex.: status_change, view, comment.", source: "budget_events.event_type", aggregatable: true },
    { name: "from_status", kind: "string", label: "De", meaning: "Status anterior.", source: "budget_events.from_status" },
    { name: "to_status", kind: "string", label: "Para", meaning: "Status novo.", source: "budget_events.to_status" },
    { name: "user_id", kind: "id", label: "Usuário", meaning: "Quem realizou.", source: "budget_events.user_id" },
    { name: "created_at", kind: "datetime", label: "Quando", meaning: "Timestamp do evento.", source: "budget_events.created_at" },
  ],
};

const BUDGET_LOST_REASONS: EntityDefinition = {
  key: "budget_lost_reasons",
  name: "Motivos de Perda",
  domain: "comercial",
  description: "Motivo qualificado quando um orçamento é marcado como perdido. Inclui concorrente e valor concorrente quando informado.",
  defaultDateField: "lost_at",
  reliability: "medium",
  knownLimitations: [
    "Preenchimento depende do comercial — pode haver perdas sem registro.",
  ],
  fields: [
    { name: "budget_id", kind: "id", label: "Orçamento", meaning: "Orçamento perdido.", source: "budget_lost_reasons.budget_id" },
    { name: "reason_category", kind: "string", label: "Categoria", meaning: "Categoria do motivo (preço, prazo, concorrente, sem retorno...).", source: "budget_lost_reasons.reason_category", aggregatable: true },
    { name: "reason_detail", kind: "text", label: "Detalhe", meaning: "Detalhe escrito pelo comercial.", source: "budget_lost_reasons.reason_detail" },
    { name: "competitor_name", kind: "string", label: "Concorrente", meaning: "Concorrente vencedor.", source: "budget_lost_reasons.competitor_name", aggregatable: true },
    { name: "competitor_value", kind: "currency_brl", label: "Valor concorrente", meaning: "Valor cobrado pelo concorrente.", source: "budget_lost_reasons.competitor_value", aggregatable: true },
    { name: "lost_at", kind: "datetime", label: "Perdido em", meaning: "Quando foi marcado como perdido.", source: "budget_lost_reasons.lost_at" },
  ],
};

const BUDGET_ACTIVITIES: EntityDefinition = {
  key: "budget_activities",
  name: "Atividades de Orçamento",
  domain: "comercial",
  description: "Tarefas e interações comerciais agendadas/executadas em torno de cada orçamento.",
  defaultDateField: "created_at",
  reliability: "medium",
  fields: [
    { name: "budget_id", kind: "id", label: "Orçamento", meaning: "Orçamento alvo.", source: "budget_activities.budget_id" },
    { name: "type", kind: "string", label: "Tipo", meaning: "Ligação, reunião, follow-up, e-mail...", source: "budget_activities.type", aggregatable: true },
    { name: "owner_id", kind: "id", label: "Responsável", meaning: "Responsável pela atividade.", source: "budget_activities.owner_id" },
    { name: "scheduled_for", kind: "datetime", label: "Agendada para", meaning: "Quando deve acontecer.", source: "budget_activities.scheduled_for" },
    { name: "completed_at", kind: "datetime", label: "Concluída em", meaning: "Quando foi concluída.", source: "budget_activities.completed_at" },
    { name: "outcome", kind: "string", label: "Resultado", meaning: "Resultado da atividade.", source: "budget_activities.outcome" },
  ],
};

const DEAL_PIPELINES: EntityDefinition = {
  key: "deal_pipelines",
  name: "Pipelines Comerciais",
  domain: "comercial",
  description: "Definição dos pipelines comerciais (ex.: Reformas, Construção, Manutenção).",
  reliability: "high",
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Pipeline.", source: "deal_pipelines.id" },
    { name: "name", kind: "string", label: "Nome", meaning: "Nome do pipeline.", source: "deal_pipelines.name" },
    { name: "is_default", kind: "boolean", label: "Padrão?", meaning: "Pipeline default.", source: "deal_pipelines.is_default" },
    { name: "is_active", kind: "boolean", label: "Ativo?", meaning: "Se está em uso.", source: "deal_pipelines.is_active" },
  ],
};

const OPERATIONS_ALERTS: EntityDefinition = {
  key: "operations_alerts",
  name: "Alertas Operacionais",
  domain: "operacional",
  description: "Alertas estruturados (SLA, gargalo, anomalia) gerados pelo job diário de snapshot.",
  defaultDateField: "created_at",
  reliability: "high",
  fields: [
    { name: "alert_type", kind: "string", label: "Tipo", meaning: "Categoria do alerta.", source: "operations_alerts.alert_type", aggregatable: true },
    { name: "severity", kind: "enum", label: "Severidade", meaning: "critical/warning/info.", source: "operations_alerts.severity", aggregatable: true },
    { name: "title", kind: "string", label: "Título", meaning: "Resumo do alerta.", source: "operations_alerts.title" },
    { name: "metric_name", kind: "string", label: "Métrica", meaning: "Métrica relacionada.", source: "operations_alerts.metric_name" },
    { name: "metric_value", kind: "decimal", label: "Valor observado", meaning: "Valor que disparou o alerta.", source: "operations_alerts.metric_value" },
    { name: "threshold_value", kind: "decimal", label: "Limite", meaning: "Limite configurado.", source: "operations_alerts.threshold_value" },
    { name: "resolved", kind: "boolean", label: "Resolvido?", meaning: "Se já foi resolvido.", source: "operations_alerts.resolved" },
    { name: "snapshot_date", kind: "date", label: "Data do snapshot", meaning: "Dia da apuração.", source: "operations_alerts.snapshot_date" },
  ],
};

const DAILY_METRICS_SNAPSHOT: EntityDefinition = {
  key: "daily_metrics_snapshot",
  name: "Snapshot Diário",
  domain: "operacional",
  description: "Foto diária consolidada de KPIs operacionais e financeiros — base para evolução temporal.",
  defaultDateField: "generated_at",
  reliability: "high",
  fields: [
    { name: "generated_at", kind: "datetime", label: "Gerado em", meaning: "Data do snapshot.", source: "daily_metrics_snapshot.generated_at" },
    { name: "received_count", kind: "integer", label: "Recebidos", meaning: "Orçamentos recebidos no dia.", source: "daily_metrics_snapshot.received_count", aggregatable: true },
    { name: "backlog_count", kind: "integer", label: "Backlog", meaning: "Backlog ativo.", source: "daily_metrics_snapshot.backlog_count", aggregatable: true },
    { name: "overdue_count", kind: "integer", label: "Atrasados", meaning: "Itens fora do prazo.", source: "daily_metrics_snapshot.overdue_count", aggregatable: true },
    { name: "closed_count", kind: "integer", label: "Fechados", meaning: "Contratos fechados.", source: "daily_metrics_snapshot.closed_count", aggregatable: true },
    { name: "revenue_brl", kind: "currency_brl", label: "Receita", meaning: "Receita gerada.", source: "daily_metrics_snapshot.revenue_brl", aggregatable: true },
    { name: "conversion_rate_pct", kind: "percent", label: "Conversão", meaning: "Taxa de conversão.", source: "daily_metrics_snapshot.conversion_rate_pct" },
    { name: "gross_margin_pct", kind: "percent", label: "Margem bruta", meaning: "Margem média.", source: "daily_metrics_snapshot.gross_margin_pct" },
    { name: "avg_lead_time_days", kind: "duration_days", label: "Lead time", meaning: "Lead time médio.", source: "daily_metrics_snapshot.avg_lead_time_days" },
    { name: "health_score", kind: "score", label: "Health score", meaning: "Saúde operacional consolidada (0–100).", source: "daily_metrics_snapshot.health_score" },
  ],
};

const COMMERCIAL_TARGETS: EntityDefinition = {
  key: "commercial_targets",
  name: "Metas Comerciais",
  domain: "comercial",
  description: "Metas mensais de receita e número de fechamentos por consultor (ou globais).",
  reliability: "high",
  fields: [
    { name: "owner_id", kind: "id", label: "Responsável", meaning: "Comercial dono da meta (null = meta global).", source: "commercial_targets.owner_id" },
    { name: "target_month", kind: "date", label: "Mês", meaning: "Mês da meta (YYYY-MM-01).", source: "commercial_targets.target_month" },
    { name: "revenue_target_brl", kind: "currency_brl", label: "Meta de receita", meaning: "Meta de receita do mês.", source: "commercial_targets.revenue_target_brl" },
    { name: "deals_target", kind: "integer", label: "Meta de deals", meaning: "Quantidade de deals a fechar.", source: "commercial_targets.deals_target" },
  ],
};

const CATALOG_ITEMS: EntityDefinition = {
  key: "catalog_items",
  name: "Catálogo de Itens",
  domain: "catalogo",
  description: "Itens reutilizáveis (mão-de-obra, material, serviço) usados nos orçamentos.",
  reliability: "high",
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Item.", source: "catalog_items.id" },
    { name: "name", kind: "string", label: "Nome", meaning: "Nome do item.", source: "catalog_items.name" },
    { name: "item_type", kind: "enum", label: "Tipo", meaning: "Categoria de item.", source: "catalog_items.item_type", aggregatable: true },
    { name: "is_active", kind: "boolean", label: "Ativo?", meaning: "Se está disponível para uso.", source: "catalog_items.is_active" },
    { name: "default_supplier_id", kind: "id", label: "Fornecedor", meaning: "Fornecedor preferencial.", source: "catalog_items.default_supplier_id" },
  ],
};

const SUPPLIERS: EntityDefinition = {
  key: "suppliers",
  name: "Fornecedores",
  domain: "catalogo",
  description: "Fornecedores de itens do catálogo.",
  reliability: "medium",
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Fornecedor.", source: "suppliers.id" },
    { name: "name", kind: "string", label: "Nome", meaning: "Nome do fornecedor.", source: "suppliers.name" },
  ],
};

const PROFILES: EntityDefinition = {
  key: "profiles",
  name: "Equipe (Perfis)",
  domain: "core",
  description: "Perfis de usuários da equipe — usados para resolver `owner_id` em todas as entidades.",
  reliability: "high",
  fields: [
    { name: "id", kind: "id", label: "ID", meaning: "Identificador do usuário.", source: "profiles.id" },
    { name: "full_name", kind: "string", label: "Nome", meaning: "Nome completo.", source: "profiles.full_name" },
  ],
};

export const DATA_CATALOG: Record<EntityKey, EntityDefinition> = {
  budgets: BUDGETS,
  clients: CLIENTS,
  leads: { ...CLIENTS, key: "leads", name: "Leads", description: "Visão de clientes ainda não convertidos (status = lead/mql)." },
  lead_sources: LEAD_SOURCES,
  deal_pipelines: DEAL_PIPELINES,
  budget_events: BUDGET_EVENTS,
  budget_lost_reasons: BUDGET_LOST_REASONS,
  budget_activities: BUDGET_ACTIVITIES,
  operations_alerts: OPERATIONS_ALERTS,
  daily_metrics_snapshot: DAILY_METRICS_SNAPSHOT,
  commercial_targets: COMMERCIAL_TARGETS,
  catalog_items: CATALOG_ITEMS,
  suppliers: SUPPLIERS,
  profiles: PROFILES,
};

export function listEntities(): EntityDefinition[] {
  return Object.values(DATA_CATALOG);
}

export function getEntity(key: EntityKey): EntityDefinition {
  return DATA_CATALOG[key];
}

/** Retorna o significado humano de um campo (label + meaning). */
export function describeField(entity: EntityKey, field: string): string {
  const e = DATA_CATALOG[entity];
  const f = e?.fields.find((x) => x.name === field);
  return f ? `${f.label} — ${f.meaning}` : field;
}
