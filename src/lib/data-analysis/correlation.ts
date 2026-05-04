/**
 * Matriz de correlação Pearson entre colunas numéricas.
 *
 * Excluí pares com n < minSample. Retorna `null` quando não há ao menos
 * 2 colunas numéricas com dados suficientes.
 */

import type {
  CorrelationMatrix,
  CorrelationPair,
  DataColumn,
  DatasetRow,
} from "@/components/ai-analysis/types";
import { coerceNumber } from "./infer";
import { pearson } from "./statistics-core";

const NUMERIC_KINDS = new Set(["number", "integer", "currency", "percent"] as const);

function strengthOf(absR: number): "weak" | "moderate" | "strong" {
  if (absR >= 0.7) return "strong";
  if (absR >= 0.4) return "moderate";
  return "weak";
}

export interface CorrelationOptions {
  minSample?: number;
}

export function correlationMatrix(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
  options: CorrelationOptions = {},
): CorrelationMatrix | null {
  const minSample = options.minSample ?? 10;

  const numericCols = columns.filter((c) =>
    NUMERIC_KINDS.has(c.kind as "number" | "integer" | "currency" | "percent"),
  );
  if (numericCols.length < 2) return null;

  // pré-coerção em arrays paralelos por coluna.
  const seriesByCol = new Map<string, Array<number | null>>();
  for (const c of numericCols) {
    seriesByCol.set(c.name, rows.map((r) => coerceNumber(r[c.name])));
  }

  const names = numericCols.map((c) => c.name);
  const k = names.length;
  const values: Array<Array<number | null>> = Array.from({ length: k }, () =>
    new Array(k).fill(null),
  );

  for (let i = 0; i < k; i++) {
    values[i][i] = 1;
    for (let j = i + 1; j < k; j++) {
      const a = seriesByCol.get(names[i])!;
      const b = seriesByCol.get(names[j])!;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let r = 0; r < a.length; r++) {
        if (a[r] !== null && b[r] !== null) {
          xs.push(a[r] as number);
          ys.push(b[r] as number);
        }
      }
      if (xs.length < minSample) {
        values[i][j] = null;
        values[j][i] = null;
        continue;
      }
      const r = pearson(xs, ys);
      values[i][j] = r;
      values[j][i] = r;
    }
  }

  const topPairs: CorrelationPair[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const r = values[i][j];
      if (r === null) continue;
      const a = seriesByCol.get(names[i])!;
      const b = seriesByCol.get(names[j])!;
      let n = 0;
      for (let row = 0; row < a.length; row++) {
        if (a[row] !== null && b[row] !== null) n++;
      }
      topPairs.push({ a: names[i], b: names[j], r, n, strength: strengthOf(Math.abs(r)) });
    }
  }
  topPairs.sort((p1, p2) => Math.abs(p2.r) - Math.abs(p1.r));

  return { columns: names, values, topPairs };
}
