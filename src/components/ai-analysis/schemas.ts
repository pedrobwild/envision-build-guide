/**
 * Schemas Zod para validação na fronteira (edge function ↔ frontend,
 * uploads, payloads externos).
 *
 * Os schemas refletem os tipos em `./types.ts` mas são INTENCIONALMENTE
 * mais permissivos em alguns campos (ex.: `rows: z.array(z.record(z.unknown()))`)
 * para não quebrar callers que carregam dados arbitrários.
 *
 * Uso típico:
 *   const parsed = AnalysisRequestSchema.safeParse(payload);
 *   if (!parsed.success) return errorResponse(parsed.error);
 */

import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Dataset
// ────────────────────────────────────────────────────────────────────────────

export const ColumnKindSchema = z.enum([
  "number",
  "integer",
  "currency",
  "percent",
  "boolean",
  "string",
  "categorical",
  "date",
  "datetime",
  "id",
  "unknown",
]);

export const ColumnRoleSchema = z.enum(["metric", "dimension", "time", "identifier", "unknown"]);

export const DataColumnSchema = z.object({
  name: z.string().min(1).max(120),
  label: z.string().max(200).optional(),
  kind: ColumnKindSchema,
  role: ColumnRoleSchema,
  nonNullCount: z.number().int().nonnegative(),
  nullCount: z.number().int().nonnegative(),
  distinctCount: z.number().int().nonnegative(),
  declared: z.boolean().optional(),
});

export const DatasetRowSchema = z.record(z.unknown());

/**
 * Limites de tamanho — defesa em profundidade contra payloads abusivos.
 * Caller pode override via `createDatasetSchema({ maxRows, maxCols })`.
 */
export const DEFAULT_MAX_ROWS = 50_000;
export const DEFAULT_MAX_COLS = 200;

export function createDatasetSchema(opts: { maxRows?: number; maxCols?: number } = {}) {
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const maxCols = opts.maxCols ?? DEFAULT_MAX_COLS;
  return z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    columns: z.array(DataColumnSchema).min(1).max(maxCols),
    rows: z.array(DatasetRowSchema).max(maxRows),
    generatedAt: z.string().datetime({ offset: true }),
    source: z.string().max(500).optional(),
  });
}

export const DatasetSchema = createDatasetSchema();

// ────────────────────────────────────────────────────────────────────────────
// Quality
// ────────────────────────────────────────────────────────────────────────────

export const DataQualitySeveritySchema = z.enum(["info", "warning", "critical"]);

export const DataQualityIssueKindSchema = z.enum([
  "missing_values",
  "duplicates",
  "outliers",
  "inconsistent_types",
  "constant_column",
  "high_cardinality",
  "invalid_dates",
  "primary_key_candidate",
  "metric_dimension_inference",
]);

export const DataQualityIssueSchema = z.object({
  id: z.string(),
  kind: DataQualityIssueKindSchema,
  severity: DataQualitySeveritySchema,
  columns: z.array(z.string()),
  message: z.string().min(1).max(1000),
  suggestion: z.string().max(1000).optional(),
  evidence: z.record(z.union([z.number(), z.string()])),
});

// ────────────────────────────────────────────────────────────────────────────
// Insights estruturados + interpretação IA
// ────────────────────────────────────────────────────────────────────────────

export const ClaimNatureSchema = z.enum(["fact", "inference", "hypothesis"]);
export const ConfidenceSchema = z.enum(["low", "medium", "high"]);

export const InsightProvenanceSchema = z.object({
  source: z.string().min(1),
  datasetId: z.string().min(1),
  columns: z.array(z.string()),
  params: z.record(z.unknown()).optional(),
  inputHash: z.string().optional(),
});

export const ChartTypeSchema = z.enum([
  "bar",
  "stacked_bar",
  "horizontal_bar",
  "line",
  "area",
  "scatter",
  "histogram",
  "pie",
  "table",
  "kpi",
  "heatmap",
]);

export const ChartSpecSchema = z.object({
  type: ChartTypeSchema,
  title: z.string().min(1).max(200),
  encoding: z.object({
    x: z.string().optional(),
    y: z.string().optional(),
    series: z.string().optional(),
    color: z.string().optional(),
  }),
  data: z.array(z.record(z.union([z.number(), z.string(), z.null()]))),
  rationale: z.string().max(500).optional(),
});

export const AdvancedInsightSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  nature: ClaimNatureSchema,
  confidence: ConfidenceSchema,
  severity: DataQualitySeveritySchema,
  evidence: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.number(), z.string()]),
      unit: z.string().max(20).optional(),
    }),
  ),
  provenance: InsightProvenanceSchema,
  chart: ChartSpecSchema.optional(),
  limitations: z.array(z.string()).optional(),
});

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  rationale: z.string().min(1).max(1000),
  action: z.string().min(1).max(500),
  expectedImpact: z.string().max(500).optional(),
  effort: z.enum(["low", "medium", "high"]),
  basedOn: z.array(z.string()),
  confidence: ConfidenceSchema,
});

// ────────────────────────────────────────────────────────────────────────────
// Pedido analítico
// ────────────────────────────────────────────────────────────────────────────

export const AnalysisRequestSchema = z.object({
  dataset: DatasetSchema,
  question: z.string().max(2000).optional(),
  focusColumns: z.array(z.string()).max(50).optional(),
  options: z
    .object({
      minSampleForCorrelation: z.number().int().positive().max(10_000).optional(),
      topK: z.number().int().positive().max(100).optional(),
      timeGranularity: z.enum(["day", "week", "month"]).optional(),
      enableForecast: z.boolean().optional(),
      appliedFilters: z.record(z.unknown()).optional(),
    })
    .optional(),
});

// ────────────────────────────────────────────────────────────────────────────
// Saída obrigatória do interpretador IA
// ────────────────────────────────────────────────────────────────────────────

export const AiInterpretationSchema = z.object({
  executiveSummary: z.string().min(1).max(2000),
  keyFindings: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(1500),
        nature: ClaimNatureSchema,
        backedBy: z.array(z.string()).min(1),
      }),
    )
    .max(20),
  dataQualityWarnings: z.array(z.string()).max(20),
  recommendedAnalyses: z.array(z.string()).max(20),
  businessRecommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        rationale: z.string().min(1).max(1000),
        action: z.string().min(1).max(500),
      }),
    )
    .max(20),
  confidence: ConfidenceSchema,
  limitations: z.array(z.string()).max(20),
});

export type AiInterpretationParsed = z.infer<typeof AiInterpretationSchema>;
