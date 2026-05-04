import type {
  DataColumn,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Sinaliza inferências automáticas de papel (metric vs dimension) que
 * podem ter sido erradas — ex.: coluna numérica com cardinalidade muito
 * baixa marcada como metric quando provavelmente é dimension (status code).
 */
const NUMERIC_KINDS = new Set(["number", "integer", "currency", "percent"] as const);

export function detectRoleInferenceIssues(
  columns: readonly DataColumn[],
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  for (const c of columns) {
    if (!NUMERIC_KINDS.has(c.kind as "number" | "integer" | "currency" | "percent")) continue;
    if (c.role !== "metric") continue;
    // Numérico mas com cardinalidade muito baixa → suspeita de ser dimensão (código de status, ID enumerado).
    if (c.distinctCount > 0 && c.distinctCount <= 10 && c.nonNullCount >= 30) {
      out.push({
        id: `metric_dimension_inference:${c.name}`,
        kind: "metric_dimension_inference",
        severity: "info",
        columns: [c.name],
        message: `Coluna "${c.label ?? c.name}" é numérica mas só tem ${c.distinctCount} valores únicos — pode ser uma dimensão (código), não métrica.`,
        suggestion:
          "Confirme com o domínio: se for código (ex.: status_code 1..5), trate como categoria.",
        evidence: {
          distinct_count: c.distinctCount,
          non_null_count: c.nonNullCount,
        },
      });
    }
  }
  return out;
}
