import type {
  DataColumn,
  DatasetRow,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Detecta colunas com excesso de valores ausentes.
 * Severidade:
 *  - critical: ≥ 80% missing
 *  - warning : ≥ 30% missing
 *  - info    : ≥ 10% missing
 */
export function detectMissing(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  const total = rows.length;
  if (total === 0) return out;
  for (const c of columns) {
    const missingPct = total === 0 ? 0 : c.nullCount / total;
    if (missingPct < 0.1) continue;
    const severity =
      missingPct >= 0.8 ? "critical" : missingPct >= 0.3 ? "warning" : "info";
    out.push({
      id: `missing_values:${c.name}`,
      kind: "missing_values",
      severity,
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" tem ${(missingPct * 100).toFixed(1)}% de valores ausentes (${c.nullCount} de ${total}).`,
      suggestion:
        missingPct >= 0.8
          ? "Considere remover esta coluna da análise — quase tudo vazio."
          : missingPct >= 0.3
          ? "Investigue se é falta no fluxo de captação ou se realmente é opcional."
          : "Verifique se há padrão temporal ou por origem nos valores ausentes.",
      evidence: {
        missing_count: c.nullCount,
        total_rows: total,
        missing_pct: Number((missingPct * 100).toFixed(2)),
      },
    });
  }
  return out;
}
