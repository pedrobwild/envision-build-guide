/**
 * Núcleo estatístico determinístico para a camada de análise avançada.
 *
 * Todas as funções são puras, defensivas a arrays vazios (retornam null em
 * vez de NaN) e não fazem I/O. Não usar `Math.min/max(...arr)` em arrays
 * grandes (risco de stack overflow); usar reduce.
 */

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function toFiniteNumbers(values: readonly unknown[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    else if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      out.push(Number(v));
    }
  }
  return out;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) if (Number.isFinite(v)) total += v;
  return total;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = sum(values);
  return s / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function minimum(values: readonly number[]): number | null {
  let m: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (m === null || v < m) m = v;
  }
  return m;
}

export function maximum(values: readonly number[]): number | null {
  let m: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (m === null || v > m) m = v;
  }
  return m;
}

/**
 * Variância amostral (n-1). Retorna null para n<2.
 */
export function variance(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mu = mean(values);
  if (mu === null) return null;
  let acc = 0;
  for (const v of values) acc += (v - mu) ** 2;
  return acc / (values.length - 1);
}

export function stdDev(values: readonly number[]): number | null {
  const v = variance(values);
  return v === null ? null : Math.sqrt(v);
}

/**
 * Median absolute deviation — alternativa robusta a stdDev.
 */
export function mad(values: readonly number[]): number | null {
  const m = median(values);
  if (m === null) return null;
  const deviations = values.filter(Number.isFinite).map((v) => Math.abs(v - m));
  return median(deviations);
}

/**
 * Percentil pela definição "linear interpolation between closest ranks"
 * (compatível com numpy default). p ∈ [0, 1].
 */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p < 0 || p > 1) throw new RangeError(`percentile p out of range: ${p}`);
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

/**
 * Z-score robusto baseado em MAD (resistente a outliers).
 */
export function zScoreRobust(value: number, values: readonly number[]): number | null {
  const m = median(values);
  const d = mad(values);
  if (m === null || d === null || d === 0) return null;
  // 1.4826 — fator de consistência para distribuição normal.
  return (value - m) / (1.4826 * d);
}

/**
 * Pearson correlation. Retorna null para n<2 ou variância zero.
 */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const mx = sumX / n;
  const my = sumY / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return num / denom;
}

export interface LinearFit {
  slope: number;
  intercept: number;
  r2: number;
  /** desvio-padrão dos resíduos (se). */
  residualStd: number;
  n: number;
}

/**
 * Regressão linear simples y = slope*x + intercept.
 * Retorna null se n<2 ou variância em x = 0.
 */
export function linearRegression(xs: readonly number[], ys: readonly number[]): LinearFit | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const muY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yhat = slope * xs[i] + intercept;
    ssRes += (ys[i] - yhat) ** 2;
    ssTot += (ys[i] - muY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const residualStd = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  return { slope, intercept, r2, residualStd, n };
}

/**
 * Regra de Sturges para bucketCount em histogramas.
 */
export function sturgesBuckets(n: number): number {
  if (n <= 1) return 1;
  return Math.max(1, Math.ceil(Math.log2(n) + 1));
}
