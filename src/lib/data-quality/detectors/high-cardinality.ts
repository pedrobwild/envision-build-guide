import type {
  DataColumn,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Coluna categorical/string com cardinalidade desproporcional sugere texto livre.
 * Threshold: distinct > 50 e distinct/n > 0.5 (mais de metade dos valores únicos).
 */
export function detectHighCardinality(
  columns: readonly DataColumn[],
  rowCount: number,
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  if (rowCount === 0) return out;
  for (const c of columns) {
    if (c.role === "identifier") continue;
    if (c.kind !== "categorical" && c.kind !== "string") continue;
    if (c.distinctCount <= 50) continue;
    const ratio = c.distinctCount / Math.max(c.nonNullCount, 1);
    if (ratio < 0.5) continue;
    out.push({
      id: `high_cardinality:${c.name}`,
      kind: "high_cardinality",
      severity: "info",
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" tem cardinalidade alta (${c.distinctCount} valores únicos em ${c.nonNullCount} linhas).`,
      suggestion:
        "Provavelmente é texto livre. Considere normalizar (categorias canônicas) antes de agrupar.",
      evidence: {
        distinct_count: c.distinctCount,
        non_null_count: c.nonNullCount,
        distinct_ratio: Number(ratio.toFixed(2)),
      },
    });
  }
  return out;
}
