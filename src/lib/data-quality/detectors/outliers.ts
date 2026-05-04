import type {
  DataColumn,
  DatasetRow,
  DataQualityIssue,
} from "@/components/ai-analysis/types";
import { coerceNumber } from "@/lib/data-analysis/infer";
import { detectAnomaliesInSeries } from "@/lib/data-analysis/anomalies";

/**
 * Detecta colunas numéricas com excesso de outliers (IQR).
 *  - info: 1-5% outliers
 *  - warning: 5-15% outliers
 *  - critical: >15% outliers (provavelmente o método ou os dados estão errados)
 */
const NUMERIC_KINDS = new Set(["number", "integer", "currency", "percent"] as const);

export function detectOutliers(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  for (const c of columns) {
    if (!NUMERIC_KINDS.has(c.kind as "number" | "integer" | "currency" | "percent")) continue;
    const values: number[] = [];
    for (const r of rows) {
      const v = coerceNumber(r[c.name]);
      if (v !== null) values.push(v);
    }
    if (values.length < 8) continue;
    const anomalies = detectAnomaliesInSeries(values, c.name, { method: "iqr" });
    if (anomalies.length === 0) continue;
    const pct = anomalies.length / values.length;
    if (pct < 0.01) continue;
    const severity = pct > 0.15 ? "critical" : pct > 0.05 ? "warning" : "info";
    out.push({
      id: `outliers:${c.name}`,
      kind: "outliers",
      severity,
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" tem ${anomalies.length} outlier(s) pelo método IQR (${(pct * 100).toFixed(1)}% das linhas).`,
      suggestion:
        pct > 0.15
          ? "Avalie se a coluna mistura unidades diferentes (ex.: BRL e USD) ou tem erros de digitação."
          : "Inspecione manualmente — outliers podem ser legítimos (ex.: clientes premium).",
      evidence: {
        outlier_count: anomalies.length,
        sample_size: values.length,
        outlier_pct: Number((pct * 100).toFixed(2)),
      },
    });
  }
  return out;
}
