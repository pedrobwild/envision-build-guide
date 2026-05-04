import type {
  DataColumn,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Coluna com 1 único valor distinto adiciona ruído analítico.
 * Severidade: warning.
 */
export function detectConstantColumns(columns: readonly DataColumn[]): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  for (const c of columns) {
    if (c.nonNullCount > 0 && c.distinctCount <= 1) {
      out.push({
        id: `constant_column:${c.name}`,
        kind: "constant_column",
        severity: "warning",
        columns: [c.name],
        message: `Coluna "${c.label ?? c.name}" tem um único valor — não contribui para a análise.`,
        suggestion: "Remova da análise ou da extração se não for necessária.",
        evidence: {
          distinct_count: c.distinctCount,
          non_null_count: c.nonNullCount,
        },
      });
    }
  }
  return out;
}
