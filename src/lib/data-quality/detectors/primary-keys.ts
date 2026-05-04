import type {
  DataColumn,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Identifica colunas que são candidatas a chave primária (distinct = nonNull,
 * sem nulls). Útil para a UI sugerir "use esta coluna como identificador".
 */
export function detectPrimaryKeyCandidates(
  columns: readonly DataColumn[],
  rowCount: number,
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  if (rowCount === 0) return out;
  for (const c of columns) {
    if (c.kind !== "id" && c.kind !== "string" && c.kind !== "integer") continue;
    if (c.nullCount > 0) continue;
    if (c.distinctCount !== rowCount) continue;
    out.push({
      id: `primary_key_candidate:${c.name}`,
      kind: "primary_key_candidate",
      severity: "info",
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" é única (${c.distinctCount}/${rowCount}) e candidata a chave primária.`,
      suggestion: "Use como identificador na análise; não agregue por ela.",
      evidence: {
        distinct_count: c.distinctCount,
        row_count: rowCount,
      },
    });
  }
  return out;
}
