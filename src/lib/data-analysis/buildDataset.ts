/**
 * Constrói um `Dataset` a partir de linhas brutas, inferindo schema.
 *
 * Use quando o caller só tem `rows` e quer rodar o pipeline analítico
 * sem declarar colunas manualmente. Para datasets já tipados (vindos do
 * Supabase), passe `declaredColumns` para evitar inferência heurística.
 */

import type {
  ColumnKind,
  ColumnRole,
  DataColumn,
  Dataset,
  DatasetRow,
} from "@/components/ai-analysis/types";
import { inferColumnKind, inferColumnRole, type InferOptions } from "./infer";

export interface BuildDatasetOptions {
  id: string;
  name: string;
  description?: string;
  source?: string;
  /** sobrescrever inferência por coluna. */
  declaredColumns?: Partial<Record<string, { kind?: ColumnKind; role?: ColumnRole; label?: string }>>;
  inferOptions?: InferOptions;
}

function distinctOf(values: readonly unknown[]): number {
  const set = new Set<string>();
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    set.add(String(v));
  }
  return set.size;
}

export function buildDataset(rows: readonly DatasetRow[], opts: BuildDatasetOptions): Dataset {
  const columnNames = Array.from(
    rows.reduce<Set<string>>((acc, r) => {
      for (const k of Object.keys(r)) acc.add(k);
      return acc;
    }, new Set()),
  );

  const columns: DataColumn[] = columnNames.map((name) => {
    const declared = opts.declaredColumns?.[name];
    const values = rows.map((r) => r[name]);
    const kind: ColumnKind =
      declared?.kind ?? inferColumnKind(name, values, opts.inferOptions);
    const distinctCount = distinctOf(values);
    const nonNullCount = values.filter(
      (v) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === ""),
    ).length;
    const nullCount = values.length - nonNullCount;
    const role: ColumnRole = inferColumnRole(name, kind, {
      distinctCount,
      rowCount: values.length,
      declared: declared?.role,
    });
    return {
      name,
      label: declared?.label,
      kind,
      role,
      nonNullCount,
      nullCount,
      distinctCount,
      declared: declared !== undefined,
    };
  });

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    columns,
    rows: [...rows],
    generatedAt: new Date().toISOString(),
    source: opts.source,
  };
}
