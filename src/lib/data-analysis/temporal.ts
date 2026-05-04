/**
 * Tendências temporais determinísticas.
 *
 * Para cada par (timeColumn, metric):
 *  1. agrupa metric por dia/semana/mês
 *  2. roda regressão linear na série
 *  3. classifica direção via slope normalizada e r²
 */

import type {
  DataColumn,
  DatasetRow,
  TemporalTrend,
} from "@/components/ai-analysis/types";
import { coerceNumber, coerceTimestamp } from "./infer";
import { linearRegression, mean } from "./statistics-core";

const TIME_KINDS = new Set(["date", "datetime"] as const);
const METRIC_KINDS = new Set(["number", "integer", "currency", "percent"] as const);

export type Granularity = "day" | "week" | "month";

function bucketKey(epochMs: number, g: Granularity): string {
  const d = new Date(epochMs);
  if (g === "day") return d.toISOString().slice(0, 10);
  if (g === "month") return d.toISOString().slice(0, 7);
  // week: ISO week start (Monday) em UTC
  const tmp = new Date(d.getTime());
  const day = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - day);
  return tmp.toISOString().slice(0, 10);
}

function classify(slope: number | null, r2: number | null, mu: number | null): TemporalTrend["direction"] {
  if (slope === null || r2 === null || mu === null) return "insufficient";
  if (mu === 0) return slope === 0 ? "flat" : slope > 0 ? "up" : "down";
  const normalizedSlope = slope / Math.abs(mu);
  if (Math.abs(normalizedSlope) < 0.01) return "flat";
  if (r2 < 0.2) return "noisy";
  return slope > 0 ? "up" : "down";
}

export interface TrendOptions {
  granularity?: Granularity;
  /** N mínimo de buckets para tentar regressão. default 4. */
  minBuckets?: number;
  /** se true, agrega por COUNT em vez de SOMA. */
  countMode?: boolean;
}

export function trendForPair(
  timeColumn: string,
  metricColumn: string | null,
  rows: readonly DatasetRow[],
  options: TrendOptions = {},
): TemporalTrend {
  const granularity: Granularity = options.granularity ?? "day";
  const countMode = options.countMode ?? false;

  const buckets = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const t = coerceTimestamp(r[timeColumn]);
    if (t === null) continue;
    const v = countMode ? 1 : metricColumn ? coerceNumber(r[metricColumn]) : 1;
    if (v === null) continue;
    const k = bucketKey(t, granularity);
    const entry = buckets.get(k) ?? { sum: 0, count: 0 };
    entry.sum += v;
    entry.count += 1;
    buckets.set(k, entry);
  }

  const series = [...buckets.entries()]
    .map(([t, b]) => ({ t, value: countMode ? b.count : b.sum }))
    .sort((a, b) => a.t.localeCompare(b.t));

  const minBuckets = options.minBuckets ?? 4;
  if (series.length < minBuckets) {
    return {
      metric: metricColumn ?? "(count)",
      timeColumn,
      granularity,
      series,
      slope: null,
      intercept: null,
      r2: null,
      direction: "insufficient",
    };
  }

  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.value);
  const fit = linearRegression(xs, ys);
  const mu = mean(ys);
  return {
    metric: metricColumn ?? "(count)",
    timeColumn,
    granularity,
    series,
    slope: fit?.slope ?? null,
    intercept: fit?.intercept ?? null,
    r2: fit?.r2 ?? null,
    direction: classify(fit?.slope ?? null, fit?.r2 ?? null, mu),
  };
}

export function detectTrends(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
  options: TrendOptions = {},
): TemporalTrend[] {
  const timeCols = columns.filter((c) => TIME_KINDS.has(c.kind as "date" | "datetime"));
  const metricCols = columns.filter((c) =>
    METRIC_KINDS.has(c.kind as "number" | "integer" | "currency" | "percent"),
  );
  if (timeCols.length === 0) return [];

  const results: TemporalTrend[] = [];
  // 1) Para cada combinação time+metric.
  for (const t of timeCols) {
    for (const m of metricCols) {
      results.push(trendForPair(t.name, m.name, rows, options));
    }
    // 2) Plus a tendência de "volume" (count) por time.
    results.push(trendForPair(t.name, null, rows, { ...options, countMode: true }));
  }
  return results;
}
