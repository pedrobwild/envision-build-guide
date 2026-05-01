/**
 * Heurística simples para ordenar insights por relevância na UI.
 *
 * Score = severityWeight * 0.45 + magnitude * 0.35 + confidence * 0.20
 *
 * - severityWeight: critical=1, high=0.85, medium=0.6, low=0.35, info=0.2
 * - magnitude: |% change| capped em 100, normalizado para [0,1].
 * - confidence: já em [0,1].
 *
 * Esta separação evita que um insight "info" com confiança alta passe na
 * frente de um "critical" com confiança média — alinha priorização ao
 * impacto de negócio.
 */

import type { Insight, InsightSeverity } from "./types";

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = {
  critical: 1,
  high: 0.85,
  medium: 0.6,
  low: 0.35,
  info: 0.2,
};

export function scoreInsight(insight: Insight): number {
  const severity = insight.severity ?? "info";
  const sevW = SEVERITY_WEIGHT[severity];
  const change = insight.evidence.find((e) => e.change != null)?.change;
  const magnitude = change == null ? 0.4 : Math.min(1, Math.abs(change) / 100);
  const conf = Math.min(1, Math.max(0, insight.confidence ?? 0.5));
  return Number((sevW * 0.45 + magnitude * 0.35 + conf * 0.2).toFixed(4));
}

export function rankInsights(insights: Insight[]): Insight[] {
  return [...insights]
    .map((i) => ({ ...i, score: scoreInsight(i) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
