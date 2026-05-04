import type {
  DataColumn,
  DatasetRow,
  DataQualityIssue,
} from "@/components/ai-analysis/types";

/**
 * Detecta colunas declaradas como numéricas/data/boolean que contêm valores
 * incompatíveis (ex.: string em coluna de currency).
 *
 * Conta valores não-conformes; se ≥1% emite warning, ≥5% emite critical.
 */
export function detectInconsistentTypes(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
): DataQualityIssue[] {
  const out: DataQualityIssue[] = [];
  for (const c of columns) {
    let nonconforming = 0;
    let total = 0;
    for (const r of rows) {
      const v = r[c.name];
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      total++;
      if (!conformsTo(c.kind, v)) nonconforming++;
    }
    if (total === 0 || nonconforming === 0) continue;
    const pct = nonconforming / total;
    if (pct < 0.01) continue;
    const severity = pct >= 0.05 ? "critical" : "warning";
    out.push({
      id: `inconsistent_types:${c.name}`,
      kind: "inconsistent_types",
      severity,
      columns: [c.name],
      message: `Coluna "${c.label ?? c.name}" está declarada como ${c.kind} mas tem ${nonconforming} valor(es) inconsistente(s) (${(pct * 100).toFixed(2)}%).`,
      suggestion:
        "Padronize na ingestão (ex.: valida no insert) ou ajuste o tipo declarado.",
      evidence: {
        nonconforming_count: nonconforming,
        sample_size: total,
        nonconforming_pct: Number((pct * 100).toFixed(2)),
        declared_kind: c.kind,
      },
    });
  }
  return out;
}

function conformsTo(kind: DataColumn["kind"], v: unknown): boolean {
  switch (kind) {
    case "number":
    case "integer":
    case "currency":
    case "percent":
      if (typeof v === "number") return Number.isFinite(v);
      if (typeof v === "string") {
        const n = Number(v.trim());
        return Number.isFinite(n);
      }
      return false;
    case "boolean":
      if (typeof v === "boolean") return true;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return ["true", "false", "yes", "no", "sim", "não", "nao"].includes(s);
      }
      return false;
    case "date":
    case "datetime":
      if (v instanceof Date) return !Number.isNaN(v.getTime());
      if (typeof v === "string") return !Number.isNaN(Date.parse(v));
      return false;
    case "id":
    case "string":
    case "categorical":
    case "unknown":
    default:
      return true;
  }
}
