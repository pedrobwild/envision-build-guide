/**
 * Contratos da camada de **análise avançada de dados**.
 *
 * Esta camada opera sobre `Dataset`s genéricos — qualquer tabela linha-coluna
 * com tipos inferidos. É independente do schema do BWild e dos tipos
 * legados em `src/lib/ai-data/types.ts` (que continuam servindo a camada
 * antiga de KPIs por orçamento).
 *
 * Princípios:
 *  - cálculos determinísticos no front; IA só interpreta `AnalysisResult`
 *    já calculado (campo `provenance` em cada `Insight` registra a função
 *    e os inputs que produziram o número).
 *  - sem `any`. Use `unknown` ou tipos discriminados.
 *  - validação na fronteira via Zod (ver `./schemas.ts`).
 */

// ────────────────────────────────────────────────────────────────────────────
// Dataset & colunas
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tipo lógico de uma coluna. Inferido em `lib/data-analysis/infer.ts` ou
 * declarado pelo caller. Driva qual conjunto de análises pode rodar.
 */
export type ColumnKind =
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "boolean"
  | "string"
  | "categorical"
  | "date"
  | "datetime"
  | "id"
  | "unknown";

/**
 * Papel analítico inferido. Usado para sugerir gráfico e métrica.
 *  - `metric`: numérico agregável (revenue, cycle_days).
 *  - `dimension`: chave de agrupamento (lead_source, owner_name).
 *  - `time`: eixo temporal natural.
 *  - `identifier`: PK candidata (não agregar).
 *  - `unknown`: indeterminado.
 */
export type ColumnRole = "metric" | "dimension" | "time" | "identifier" | "unknown";

export interface DataColumn {
  name: string;
  /** Label legível para UI. Defaults para `name`. */
  label?: string;
  kind: ColumnKind;
  role: ColumnRole;
  /** total de linhas com valor não-nulo. */
  nonNullCount: number;
  /** total de linhas com null/undefined/string vazia. */
  nullCount: number;
  /** distinct values count (cardinality). */
  distinctCount: number;
  /** marcado como `true` quando a coluna foi declarada pelo caller (não inferida). */
  declared?: boolean;
}

/**
 * Linha de dataset. Chaves correspondem a `DataColumn.name`.
 * Valores são `unknown` por design — cabe ao caller validar via column.kind.
 */
export type DatasetRow = Record<string, unknown>;

export interface Dataset {
  /** identificador estável (slug ou uuid). */
  id: string;
  /** nome humano. Ex.: "Orçamentos – últimos 90 dias". */
  name: string;
  /** descrição curta opcional para o usuário. */
  description?: string;
  columns: DataColumn[];
  rows: DatasetRow[];
  /** quando o dataset foi materializado (ISO 8601). */
  generatedAt: string;
  /** fonte/origem (tabela, RPC, upload). */
  source?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Qualidade de dados
// ────────────────────────────────────────────────────────────────────────────

export type DataQualitySeverity = "info" | "warning" | "critical";

export type DataQualityIssueKind =
  | "missing_values"
  | "duplicates"
  | "outliers"
  | "inconsistent_types"
  | "constant_column"
  | "high_cardinality"
  | "invalid_dates"
  | "primary_key_candidate"
  | "metric_dimension_inference";

export interface DataQualityIssue {
  /** id único determinístico (`kind:column[:detail]`). */
  id: string;
  kind: DataQualityIssueKind;
  severity: DataQualitySeverity;
  /** colunas afetadas (vazio = dataset inteiro). */
  columns: string[];
  /** explicação curta em pt-BR para o usuário não-técnico. */
  message: string;
  /** sugestão acionável. */
  suggestion?: string;
  /** evidência numérica que originou o issue. */
  evidence: Record<string, number | string>;
}

export interface DataQualityReport {
  datasetId: string;
  generatedAt: string;
  issues: DataQualityIssue[];
  /** sumário por severidade (para badge na UI). */
  counts: Record<DataQualitySeverity, number>;
  /** score de saúde 0..1 (1 = sem warnings ou criticals). */
  healthScore: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Resumos estatísticos
// ────────────────────────────────────────────────────────────────────────────

export interface NumericSummary {
  kind: "numeric";
  column: string;
  count: number;
  missing: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  /** valores únicos (limitado por uniqueLimit). */
  uniqueCount: number;
  /** histograma para chart inline; bucketSize calculado por Sturges. */
  histogram: Array<{ bucketStart: number; bucketEnd: number; count: number }>;
}

export interface CategoricalSummary {
  kind: "categorical";
  column: string;
  count: number;
  missing: number;
  uniqueCount: number;
  /** top-K categorias (default K=10) com contagem e share. */
  top: Array<{ value: string; count: number; share: number }>;
}

export interface TemporalSummary {
  kind: "temporal";
  column: string;
  count: number;
  missing: number;
  min: string | null;
  max: string | null;
  /** spread em dias entre min e max. */
  spanDays: number | null;
  /** série diária consolidada (count por dia). */
  daily: Array<{ date: string; count: number }>;
}

export interface BooleanSummary {
  kind: "boolean";
  column: string;
  count: number;
  missing: number;
  trueCount: number;
  falseCount: number;
  trueShare: number;
}

export type StatisticalSummary =
  | NumericSummary
  | CategoricalSummary
  | TemporalSummary
  | BooleanSummary;

// ────────────────────────────────────────────────────────────────────────────
// Correlação
// ────────────────────────────────────────────────────────────────────────────

export interface CorrelationPair {
  a: string;
  b: string;
  /** Pearson r ∈ [-1, 1]. */
  r: number;
  /** sample size usada. */
  n: number;
  /** força qualitativa: `weak | moderate | strong` baseada em |r|. */
  strength: "weak" | "moderate" | "strong";
}

export interface CorrelationMatrix {
  columns: string[];
  /** matriz simétrica, NaN substituído por null. */
  values: Array<Array<number | null>>;
  /** pares ordenados por |r| desc, excluindo a diagonal. */
  topPairs: CorrelationPair[];
}

// ────────────────────────────────────────────────────────────────────────────
// Tendências temporais
// ────────────────────────────────────────────────────────────────────────────

export interface TemporalTrend {
  /** coluna métrica analisada. */
  metric: string;
  /** coluna de data utilizada como eixo. */
  timeColumn: string;
  /** série em granularidade `day | week | month`. */
  granularity: "day" | "week" | "month";
  series: Array<{ t: string; value: number }>;
  /** regressão linear: slope = unidade/granularidade. */
  slope: number | null;
  intercept: number | null;
  r2: number | null;
  /** direção qualitativa baseada em slope e r². */
  direction: "up" | "down" | "flat" | "noisy" | "insufficient";
}

// ────────────────────────────────────────────────────────────────────────────
// Anomalias
// ────────────────────────────────────────────────────────────────────────────

export type AnomalyMethod = "iqr" | "zscore" | "moving_zscore";

export interface Anomaly {
  /** índice na série/linha. */
  index: number;
  /** coluna (ou métrica) onde a anomalia foi detectada. */
  column: string;
  value: number;
  /** método que detectou. */
  method: AnomalyMethod;
  /** quão "fora" está (z, ou ratio do IQR). */
  score: number;
  /** label opcional (timestamp ou id). */
  label?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Forecast
// ────────────────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  t: string;
  value: number;
  /** intervalo de confiança 95%. */
  lower: number;
  upper: number;
}

export interface ForecastResult {
  metric: string;
  timeColumn: string;
  granularity: "day" | "week" | "month";
  /** série histórica utilizada. */
  history: Array<{ t: string; value: number }>;
  /** projeção. Vazia quando dados insuficientes (com `caveat`). */
  forecast: ForecastPoint[];
  /** R² do ajuste linear no histórico. */
  r2: number | null;
  /** mensagem explicando limitações (baixa qualidade do ajuste, série curta…). */
  caveat?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Insight estruturado e auditável
// ────────────────────────────────────────────────────────────────────────────

export type InsightConfidence = "low" | "medium" | "high";

export type ClaimNature = "fact" | "inference" | "hypothesis";

/**
 * Cada `Insight` carrega `provenance`: a função pura que produziu o número
 * e os inputs ou agregados usados. Isso permite "ver o cálculo" na UI
 * (auditável) e detectar regressões via testes de fixture.
 */
export interface InsightProvenance {
  /** nome da função pura (ex.: "summarizeColumn"). */
  source: string;
  /** identificador do dataset analisado. */
  datasetId: string;
  /** colunas envolvidas. */
  columns: string[];
  /** parâmetros relevantes (ex.: granularidade, threshold). */
  params?: Record<string, unknown>;
  /** hash determinístico de inputs+params, opcional. */
  inputHash?: string;
}

export interface AdvancedInsight {
  id: string;
  /** título curto (máx ~80 chars). */
  title: string;
  /** descrição em pt-BR. */
  description: string;
  /** natureza epistêmica do achado. */
  nature: ClaimNature;
  confidence: InsightConfidence;
  severity: DataQualitySeverity;
  /** evidências numéricas (já calculadas). */
  evidence: Array<{ label: string; value: number | string; unit?: string }>;
  /** rastreabilidade. */
  provenance: InsightProvenance;
  /** sugestão de gráfico, opcional. */
  chart?: ChartSpec;
  /** limitações específicas ao insight. */
  limitations?: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  /** ação esperada do usuário (verbo no infinitivo). */
  action: string;
  expectedImpact?: string;
  effort: "low" | "medium" | "high";
  /** insights que originaram esta recomendação. */
  basedOn: string[];
  confidence: InsightConfidence;
}

// ────────────────────────────────────────────────────────────────────────────
// ChartSpec — recomendação tipada de visualização
// ────────────────────────────────────────────────────────────────────────────

export type ChartType =
  | "bar"
  | "stacked_bar"
  | "horizontal_bar"
  | "line"
  | "area"
  | "scatter"
  | "histogram"
  | "pie"
  | "table"
  | "kpi"
  | "heatmap";

export interface ChartSpec {
  type: ChartType;
  title: string;
  /** colunas / aliases mapeados aos eixos. */
  encoding: {
    x?: string;
    y?: string;
    series?: string;
    color?: string;
  };
  /** dados pré-agregados prontos para render (até `maxPoints`). */
  data: Array<Record<string, number | string | null>>;
  /** explicação curta de por que esse gráfico foi escolhido. */
  rationale?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Pedido e resultado consolidado
// ────────────────────────────────────────────────────────────────────────────

export interface AnalysisRequest {
  dataset: Dataset;
  /** pergunta opcional do usuário em pt-BR. */
  question?: string;
  /** colunas a focar (default: todas). */
  focusColumns?: string[];
  /** opções determinísticas. */
  options?: {
    /** N mínimo para tentar correlação. default 10. */
    minSampleForCorrelation?: number;
    /** quantas categorias retornar no top-K. default 10. */
    topK?: number;
    /** granularidade temporal default. */
    timeGranularity?: "day" | "week" | "month";
    /** se true, calcula forecast em colunas time+metric quando possível. */
    enableForecast?: boolean;
    /** filtros já aplicados pelo caller (somente para registro). */
    appliedFilters?: Record<string, unknown>;
  };
}

export interface AnalysisResult {
  datasetId: string;
  generatedAt: string;
  /** resumo por coluna. */
  summaries: StatisticalSummary[];
  /** correlações (apenas entre colunas numéricas). */
  correlations: CorrelationMatrix | null;
  /** tendências detectadas (apenas para combinações time + metric). */
  trends: TemporalTrend[];
  /** anomalias detectadas, agrupadas por coluna. */
  anomalies: Anomaly[];
  /** projeções, opcional. */
  forecasts: ForecastResult[];
  /** lista de insights estruturados (calculados). */
  insights: AdvancedInsight[];
  /** recomendações acionáveis (calculadas). */
  recommendations: Recommendation[];
  /** charts sugeridos. */
  charts: ChartSpec[];
  /** confiança global agregada. */
  confidence: InsightConfidence;
  /** limitações globais. */
  limitations: string[];
  /** filtros aplicados pelo caller (espelho de request.options.appliedFilters). */
  filtersApplied: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Saída do interpretador IA (item 5 do briefing)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Contrato estrito que a edge function `ai-data-analyst` deve devolver.
 * A IA NÃO inventa números — recebe `AnalysisResult` já calculado e produz
 * narrativa em pt-BR, marcando `nature` (fact/inference/hypothesis).
 */
export interface AiInterpretation {
  executiveSummary: string;
  keyFindings: Array<{
    title: string;
    description: string;
    nature: ClaimNature;
    /** id de insight calculado que sustenta esta finding. */
    backedBy: string[];
  }>;
  dataQualityWarnings: string[];
  recommendedAnalyses: string[];
  businessRecommendations: Array<{
    title: string;
    rationale: string;
    action: string;
  }>;
  confidence: InsightConfidence;
  limitations: string[];
}
