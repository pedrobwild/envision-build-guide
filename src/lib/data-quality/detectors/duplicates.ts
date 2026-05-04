import type {
  DataColumn,
  DatasetRow,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Detecta linhas duplicadas baseando-se na identidade de **todas** as colunas
 * que NÃO sejam identifiers. Se >0 duplicates, emite warning;
 * critical se ≥ 10% das linhas forem duplicadas.
 */
export function detectDuplicates(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
): DataQualityIssue[] {
  if (rows.length === 0) return [];
  const considered = columns.filter((c) => c.role !== "identifier").map((c) => c.name);
  if (considered.length === 0) return [];

  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = considered.map((n) => `${n}=${stableValue(r[n])}`).join("|");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const v of seen.values()) if (v > 1) duplicates += v - 1;
  if (duplicates === 0) return [];
  const pct = duplicates / rows.length;
  const severity = pct >= 0.1 ? "critical" : pct >= 0.02 ? "warning" : "info";
  return [
    {
      id: `duplicates:dataset`,
      kind: "duplicates",
      severity,
      columns: considered,
      message: `${duplicates} linha(s) duplicada(s) considerando ${considered.length} colunas (${(pct * 100).toFixed(2)}%).`,
      suggestion:
        "Verifique se há erro de ingestão. Se for esperado (ex.: histórico), exclua identifiers da análise.",
      evidence: {
        duplicate_rows: duplicates,
        total_rows: rows.length,
        duplicate_pct: Number((pct * 100).toFixed(2)),
      },
    },
  ];
}

function stableValue(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
