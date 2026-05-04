/**
 * Detecção de anomalias por método estatístico simples e auditável.
 *
 *  - `iqr`: |x - mediana| > 1.5 * IQR.
 *  - `zscore`: |z| > threshold (default 3) baseado em mean/std.
 *  - `moving_zscore`: z-score em janela rolante (default 7).
 *
 * Não usar isolation forest ou métodos black-box: queremos explicabilidade.
 */

import type {
  Anomaly,
  AnomalyMethod,
  DataColumn,
  DatasetRow,
} from "@/components/ai-analysis/types";
import { coerceNumber } from "./infer";
import { mean, percentile, stdDev } from "./statistics-core";

const NUMERIC_KINDS = new Set(["number", "integer", "currency", "percent"] as const);

export interface AnomalyOptions {
  /** método a usar. default 'iqr'. */
  method?: AnomalyMethod;
  /** z-threshold (zscore/moving_zscore). default 3. */
  threshold?: number;
  /** window (moving_zscore). default 7. */
  window?: number;
  /** rótulos para anotar (ex.: timestamps). */
  labels?: readonly string[];
}

function detectIQR(values: readonly number[], column: string, labels?: readonly string[]): Anomaly[] {
  if (values.length < 4) return [];
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  if (q1 === null || q3 === null) return [];
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const out: Anomaly[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < low || v > high) {
      const ratio = v < low ? (low - v) / iqr : (v - high) / iqr;
      out.push({
        index: i,
        column,
        value: v,
        method: "iqr",
        score: Number(ratio.toFixed(4)),
        label: labels?.[i],
      });
    }
  }
  return out;
}

function detectZScore(
  values: readonly number[],
  column: string,
  threshold: number,
  labels?: readonly string[],
): Anomaly[] {
  if (values.length < 3) return [];
  const mu = mean(values);
  const sd = stdDev(values);
  if (mu === null || sd === null || sd === 0) return [];
  const out: Anomaly[] = [];
  for (let i = 0; i < values.length; i++) {
    const z = (values[i] - mu) / sd;
    if (Math.abs(z) > threshold) {
      out.push({
        index: i,
        column,
        value: values[i],
        method: "zscore",
        score: Number(z.toFixed(4)),
        label: labels?.[i],
      });
    }
  }
  return out;
}

function detectMovingZ(
  values: readonly number[],
  column: string,
  threshold: number,
  window: number,
  labels?: readonly string[],
): Anomaly[] {
  if (values.length < window + 1) return [];
  const out: Anomaly[] = [];
  for (let i = window; i < values.length; i++) {
    const slice = values.slice(i - window, i);
    const mu = mean(slice);
    const sd = stdDev(slice);
    if (mu === null || sd === null || sd === 0) continue;
    const z = (values[i] - mu) / sd;
    if (Math.abs(z) > threshold) {
      out.push({
        index: i,
        column,
        value: values[i],
        method: "moving_zscore",
        score: Number(z.toFixed(4)),
        label: labels?.[i],
      });
    }
  }
  return out;
}

export function detectAnomaliesInSeries(
  values: readonly number[],
  column: string,
  options: AnomalyOptions = {},
): Anomaly[] {
  const method = options.method ?? "iqr";
  const threshold = options.threshold ?? 3;
  const window = options.window ?? 7;
  if (method === "iqr") return detectIQR(values, column, options.labels);
  if (method === "zscore") return detectZScore(values, column, threshold, options.labels);
  return detectMovingZ(values, column, threshold, window, options.labels);
}

/**
 * Roda a detecção em todas as colunas numéricas do dataset.
 */
export function detectAnomalies(
  columns: readonly DataColumn[],
  rows: readonly DatasetRow[],
  options: AnomalyOptions = {},
): Anomaly[] {
  const out: Anomaly[] = [];
  for (const c of columns) {
    if (!NUMERIC_KINDS.has(c.kind as "number" | "integer" | "currency" | "percent")) continue;
    const values: number[] = [];
    const labels: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const v = coerceNumber(rows[i][c.name]);
      if (v === null) continue;
      values.push(v);
      labels.push(String(i));
    }
    out.push(...detectAnomaliesInSeries(values, c.name, { ...options, labels }));
  }
  return out;
}
