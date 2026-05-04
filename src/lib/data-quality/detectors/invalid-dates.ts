import type {
  DataColumn,
  DatasetRow,
  DataQualityIssue,
} from "@/components/ai-analysis/types";
import { coerceTimestamp } from "@/lib/data-analysis/infer";

const DATE_KINDS = new Set(["date", "datetime"] as const);

/**
 * Datas inválidas ou em ranges absurdos:
 *  - antes de 2000 (provavelmente bug de epoch=0)
 *  - após hoje + 5 anos (provavelmente sentinel)
 *  - não-parseáveis
 */
export function detectInvalidDates(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  const minTs = Date.parse("2000-01-01");
  const maxTs = Date.now() + 5 * 365 * 86_400_000;

  for (const c of columns) {
    if (!DATE_KINDS.has(c.kind as "date" | "datetime")) continue;
    let unparsable = 0;
    let outOfRange = 0;
    let total = 0;
    for (const r of rows) {
      const v = r[c.name];
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      total++;
      const t = coerceTimestamp(v);
      if (t === null) {
        unparsable++;
        continue;
      }
      if (t < minTs || t > maxTs) outOfRange++;
    }
    if (total === 0) continue;
    const bad = unparsable + outOfRange;
    if (bad === 0) continue;
    const pct = bad / total;
    const severity = pct >= 0.05 ? "critical" : "warning";
    out.push({
      id: `invalid_dates:${c.name}`,
      kind: "invalid_dates",
      severity,
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" tem ${bad} data(s) inválida(s) ou fora do range razoável (${unparsable} não parseáveis, ${outOfRange} fora do intervalo 2000–hoje+5y).`,
      suggestion:
        "Padronize formato ISO 8601 na ingestão e valide ranges no banco (CHECK constraints).",
      evidence: {
        unparsable,
        out_of_range: outOfRange,
        sample_size: total,
        bad_pct: Number((pct * 100).toFixed(2)),
      },
    });
  }
  return out;
}
