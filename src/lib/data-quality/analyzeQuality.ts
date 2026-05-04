/**
 * Pipeline de qualidade de dados — orquestra os detectores e gera
 * `DataQualityReport`.
 *
 * Cada detector é puro, recebe `(columns, rows)` e retorna issues.
 * Aqui acumulamos, ranqueamos por severidade e calculamos health score.
 */

import type {
  Dataset,
  DataQualityIssue,
  DataQualityReport,
  DataQualitySeverity,
} from "@/components/ai-analysis/types";
import { detectMissing } from "./detectors/missing";
import { detectDuplicates } from "./detectors/duplicates";
import { detectOutliers } from "./detectors/outliers";
import { detectInconsistentTypes } from "./detectors/inconsistent-types";
import { detectConstantColumns } from "./detectors/constant-columns";
import { detectHighCardinality } from "./detectors/high-cardinality";
import { detectInvalidDates } from "./detectors/invalid-dates";
import { detectPrimaryKeyCandidates } from "./detectors/primary-keys";
import { detectRoleInferenceIssues } from "./detectors/role-inference";

const SEVERITY_ORDER: Record<DataQualitySeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_PENALTY: Record<DataQualitySeverity, number> = {
  critical: 0.4,
  warning: 0.15,
  info: 0,
};

export interface AnalyzeQualityOptions {
  /** detectores a desabilitar (use apenas em debugging). */
  disable?: Array<DataQualityIssue["kind"]>;
}

export function analyzeQuality(
  dataset: Dataset,
  options: AnalyzeQualityOptions = {},
): DataQualityReport {
  const skip = new Set<DataQualityIssue["kind"]>(options.disable ?? []);
  const issues: DataQualityIssue[] = [];

  if (!skip.has("missing_values")) issues.push(...detectMissing(dataset.columns, dataset.rows));
  if (!skip.has("duplicates")) issues.push(...detectDuplicates(dataset.columns, dataset.rows));
  if (!skip.has("outliers")) issues.push(...detectOutliers(dataset.columns, dataset.rows));
  if (!skip.has("inconsistent_types"))
    issues.push(...detectInconsistentTypes(dataset.columns, dataset.rows));
  if (!skip.has("constant_column")) issues.push(...detectConstantColumns(dataset.columns));
  if (!skip.has("high_cardinality"))
    issues.push(...detectHighCardinality(dataset.columns, dataset.rows.length));
  if (!skip.has("invalid_dates"))
    issues.push(...detectInvalidDates(dataset.columns, dataset.rows));
  if (!skip.has("primary_key_candidate"))
    issues.push(...detectPrimaryKeyCandidates(dataset.columns, dataset.rows.length));
  if (!skip.has("metric_dimension_inference"))
    issues.push(...detectRoleInferenceIssues(dataset.columns));

  // ordena por severidade depois por id (estável)
  issues.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });

  const counts: Record<DataQualitySeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const i of issues) counts[i.severity]++;

  // health score: começa em 1.0, deduz penalty por issue (cap 0).
  let penalty = 0;
  for (const i of issues) penalty += SEVERITY_PENALTY[i.severity];
  const healthScore = Math.max(0, 1 - Math.min(1, penalty));

  return {
    datasetId: dataset.id,
    generatedAt: new Date().toISOString(),
    issues,
    counts,
    healthScore: Number(healthScore.toFixed(3)),
  };
}
