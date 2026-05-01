/**
 * Tipos centrais usados por toda a camada de AI Data Analysis.
 * Mantidos isolados para que o motor de insights, planner, scoring e UI
 * compartilhem o mesmo contrato sem dependências cruzadas.
 */

export type EntityKey =
  | "budgets"
  | "clients"
  | "leads"
  | "lead_sources"
  | "deal_pipelines"
  | "budget_events"
  | "budget_lost_reasons"
  | "budget_activities"
  | "operations_alerts"
  | "daily_metrics_snapshot"
  | "commercial_targets"
  | "catalog_items"
  | "suppliers"
  | "profiles";

export type FieldKind =
  | "id"
  | "string"
  | "text"
  | "enum"
  | "boolean"
  | "integer"
  | "decimal"
  | "currency_brl"
  | "percent"
  | "date"
  | "datetime"
  | "duration_days"
  | "json"
  | "geo";

export interface FieldDefinition {
  name: string;
  kind: FieldKind;
  label: string;
  /** explica o significado de negócio do campo (1 linha). */
  meaning: string;
  /** sentinel values that should NOT be aggregated. */
  nullable?: boolean;
  /** fonte: tabela.coluna em supabase, ou virtual. */
  source?: string;
  /** valores possíveis quando enum (não exaustivo). */
  enumValues?: readonly string[];
  /** indica se o campo participa de agregações por padrão. */
  aggregatable?: boolean;
  /** baixa confiança quando dados são inconsistentes ou pouco preenchidos. */
  reliability?: "high" | "medium" | "low";
}

export interface RelationDefinition {
  to: EntityKey;
  via: string;
  cardinality: "1-1" | "1-N" | "N-1" | "N-N";
  description: string;
}

export interface EntityDefinition {
  key: EntityKey;
  name: string;
  domain: "comercial" | "operacional" | "financeiro" | "catalogo" | "core" | "leads" | "agenda";
  description: string;
  fields: FieldDefinition[];
  relations?: RelationDefinition[];
  defaultDateField?: string;
  primaryLabel?: string;
  reliability?: "high" | "medium" | "low";
  knownLimitations?: string[];
}

export type MetricUnit =
  | "count"
  | "currency_brl"
  | "percent"
  | "days"
  | "hours"
  | "ratio"
  | "score";

export type Direction = "up_is_good" | "down_is_good" | "neutral";

export interface MetricDefinition {
  id: string;
  label: string;
  description: string;
  unit: MetricUnit;
  domain: EntityDefinition["domain"];
  entity: EntityKey;
  direction: Direction;
  /** thresholds usados como semáforo de saúde. */
  healthBands?: {
    excellent?: number;
    healthy?: number;
    warning?: number;
    critical?: number;
  };
  formula?: string;
  /** quão confiáveis são os dados desta métrica. */
  reliability?: "high" | "medium" | "low";
  related?: string[];
}

export type InsightType =
  | "descriptive"
  | "diagnostic"
  | "predictive"
  | "prescriptive"
  | "comparative"
  | "funnel"
  | "financial"
  | "operational"
  | "data_quality"
  | "geographic";

export type InsightSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface InsightEvidence {
  label: string;
  value: string | number;
  change?: number;
  period?: string;
}

export type VisualizationType =
  | "kpi"
  | "line"
  | "bar"
  | "area"
  | "pie"
  | "table"
  | "scatter"
  | "heatmap"
  | "funnel"
  | "map";

export interface VisualizationHint {
  type: VisualizationType;
  x?: string;
  y?: string;
  groupBy?: string;
  series?: string[];
  data?: Array<Record<string, string | number | null>>;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  summary: string;
  evidence: InsightEvidence[];
  severity?: InsightSeverity;
  confidence: number;
  recommendedAction?: string;
  visualization?: VisualizationHint;
  limitations?: string[];
  /** entidade principal e métrica relacionada para navegação contextual. */
  entity?: EntityKey;
  metricId?: string;
  /** ranking opcional para ordenação na UI. */
  score?: number;
}

export interface AnalysisContext {
  /** período em análise. */
  range?: { from: Date; to: Date };
  /** entidade foco da pergunta. */
  entity?: EntityKey;
  /** filtros aplicados pelo usuário. */
  filters?: Record<string, unknown>;
  /** papel do usuário (impacta sugestões/segurança). */
  role?: "admin" | "comercial" | "orcamentista" | string;
  /** tela em que o usuário está. */
  screen?: string;
  /** pergunta em linguagem natural. */
  question?: string;
}

export interface AnalysisResult {
  /** resposta resumida em linguagem natural. */
  answer: string;
  insights: Insight[];
  metricsUsed: string[];
  visualizations: VisualizationHint[];
  filtersApplied: Record<string, unknown>;
  confidence: number;
  limitations: string[];
  nextSteps: string[];
  generatedAt: string;
}
