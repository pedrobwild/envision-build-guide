/**
 * Resumos estatísticos por coluna.
 *
 * Para colunas numéricas: count, missing, mean, median, std, min/max, p25/75/90,
 * histograma (Sturges).
 * Para categóricas: contagem, distinct, top-K.
 * Para temporais: min/max/spanDays, série diária.
 * Para boolean: trueCount/falseCount/share.
 *
 * Tudo determinístico e puro.
 */

import type {
  BooleanSummary,
  CategoricalSummary,
  DataColumn,
  DatasetRow,
  NumericSummary,
  StatisticalSummary,
  TemporalSummary,
} from "@/components/ai-analysis/types";
import {
  maximum,
  mean,
  median,
  minimum,
  percentile,
  stdDev,
  sturgesBuckets,
} from "./statistics-core";
import { coerceNumber, coerceTimestamp } from "./infer";

const CATEGORICAL_TOP_K_DEFAULT = 10;

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function summarizeNumeric(column: DataColumn, values: readonly unknown[]): NumericSummary {
  const nums: number[] = [];
  let missing = 0;
  for (const v of values) {
    if (isMissing(v)) {
      missing++;
      continue;
    }
    const n = coerceNumber(v);
    if (n !== null) nums.push(n);
    else missing++;
  }

  const histogram: NumericSummary["histogram"] = [];
  if (nums.length > 0) {
    const lo = minimum(nums) ?? 0;
    const hi = maximum(nums) ?? 0;
    if (hi > lo) {
      const k = sturgesBuckets(nums.length);
      const step = (hi - lo) / k;
      const buckets = new Array(k).fill(0).map((_, i) => ({
        bucketStart: lo + i * step,
        bucketEnd: i === k - 1 ? hi : lo + (i + 1) * step,
        count: 0,
      }));
      for (const v of nums) {
        let idx = Math.floor((v - lo) / step);
        if (idx >= k) idx = k - 1;
        if (idx < 0) idx = 0;
        buckets[idx].count++;
      }
      histogram.push(...buckets);
    } else {
      // todos iguais — bucket único
      histogram.push({ bucketStart: lo, bucketEnd: lo, count: nums.length });
    }
  }

  return {
    kind: "numeric",
    column: column.name,
    count: nums.length,
    missing,
    mean: mean(nums),
    median: median(nums),
    stdDev: stdDev(nums),
    min: minimum(nums),
    max: maximum(nums),
    p25: percentile(nums, 0.25),
    p75: percentile(nums, 0.75),
    p90: percentile(nums, 0.9),
    uniqueCount: new Set(nums).size,
    histogram,
  };
}

function summarizeCategorical(
  column: DataColumn,
  values: readonly unknown[],
  topK: number,
): CategoricalSummary {
  const freq = new Map<string, number>();
  let missing = 0;
  let total = 0;
  for (const v of values) {
    if (isMissing(v)) {
      missing++;
      continue;
    }
    total++;
    const key = String(v);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const top = [...freq.entries()]
    .map(([value, count]) => ({ value, count, share: total === 0 ? 0 : count / total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topK);
  return {
    kind: "categorical",
    column: column.name,
    count: total,
    missing,
    uniqueCount: freq.size,
    top,
  };
}

function summarizeTemporal(column: DataColumn, values: readonly unknown[]): TemporalSummary {
  let missing = 0;
  const ts: number[] = [];
  for (const v of values) {
    if (isMissing(v)) {
      missing++;
      continue;
    }
    const t = coerceTimestamp(v);
    if (t !== null) ts.push(t);
    else missing++;
  }

  const minT = minimum(ts);
  const maxT = maximum(ts);
  const spanDays = minT !== null && maxT !== null ? (maxT - minT) / 86_400_000 : null;

  // série diária
  const dayBuckets = new Map<string, number>();
  for (const t of ts) {
    const d = new Date(t).toISOString().slice(0, 10);
    dayBuckets.set(d, (dayBuckets.get(d) ?? 0) + 1);
  }
  const daily = [...dayBuckets.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    kind: "temporal",
    column: column.name,
    count: ts.length,
    missing,
    min: minT === null ? null : new Date(minT).toISOString(),
    max: maxT === null ? null : new Date(maxT).toISOString(),
    spanDays,
    daily,
  };
}

function summarizeBoolean(column: DataColumn, values: readonly unknown[]): BooleanSummary {
  let missing = 0;
  let trueCount = 0;
  let falseCount = 0;
  for (const v of values) {
    if (isMissing(v)) {
      missing++;
      continue;
    }
    if (v === true || v === "true" || v === 1 || v === "yes" || v === "sim") trueCount++;
    else if (v === false || v === "false" || v === 0 || v === "no" || v === "não" || v === "nao") {
      falseCount++;
    } else {
      missing++;
    }
  }
  const total = trueCount + falseCount;
  return {
    kind: "boolean",
    column: column.name,
    count: total,
    missing,
    trueCount,
    falseCount,
    trueShare: total === 0 ? 0 : trueCount / total,
  };
}

/**
 * Resume uma coluna conforme seu `kind`.
 * Caller passa `column` e a coluna extraída do dataset.
 */
export function summarizeColumn(
  column: DataColumn,
  values: readonly unknown[],
  options: { topK?: number } = {},
): StatisticalSummary {
  const topK = options.topK ?? CATEGORICAL_TOP_K_DEFAULT;
  switch (column.kind) {
    case "number":
    case "integer":
    case "currency":
    case "percent":
      return summarizeNumeric(column, values);
    case "boolean":
      return summarizeBoolean(column, values);
    case "date":
    case "datetime":
      return summarizeTemporal(column, values);
    case "categorical":
    case "string":
    case "id":
    case "unknown":
    default:
      return summarizeCategorical(column, values, topK);
  }
}

/**
 * Resume todas as colunas do dataset. Se `focus` informado, limita ao subset.
 */
export function summarizeAll(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
  options: { topK?: number; focus?: readonly string[] } = {},
): StatisticalSummary[] {
  const focus = options.focus ? new Set(options.focus) : null;
  return columns
    .filter((c) => (focus ? focus.has(c.name) : true))
    .map((c) => summarizeColumn(c, rows.map((r) => r[c.name]), { topK: options.topK }));
}
