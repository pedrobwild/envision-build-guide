/**
 * Funções estatísticas puras usadas pelo motor de insights.
 *
 * Todas as funções são determinísticas, não fazem I/O e tratam arrays vazios
 * de forma defensiva (retornam null ao invés de NaN). Isso permite testar
 * facilmente e compor com segurança em pipelines de análise.
 */

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) {
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

export function mean(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  return sum(finite) / finite.length;
}

export function median(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}

export function min(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  return finite.length === 0 ? null : Math.min(...finite);
}

export function max(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  return finite.length === 0 ? null : Math.max(...finite);
}

export function stdDev(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length < 2) return null;
  const mu = sum(finite) / finite.length;
  const variance = sum(finite.map((v) => (v - mu) ** 2)) / (finite.length - 1);
  return Math.sqrt(variance);
}

/** Variação percentual com proteção contra divisão por zero. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Diferença absoluta. */
export function absoluteChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

/** Detecta outliers usando o método IQR (1.5 * IQR). Retorna índices. */
export function outliers(values: number[]): number[] {
  const finite = values.map((v, i) => ({ v, i })).filter((x) => Number.isFinite(x.v));
  if (finite.length < 4) return [];
  const sorted = [...finite].sort((a, b) => a.v - b.v);
  const q1 = sorted[Math.floor(sorted.length * 0.25)].v;
  const q3 = sorted[Math.floor(sorted.length * 0.75)].v;
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return finite.filter((x) => x.v < low || x.v > high).map((x) => x.i);
}

/** Média móvel simples. window padrão = 3. */
export function movingAverage(values: number[], window = 3): number[] {
  if (window < 1) return values.slice();
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1).filter((v) => Number.isFinite(v));
    out.push(slice.length === 0 ? 0 : slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

/**
 * Tendência linear simples (least squares).
 * Retorna { slope, intercept, r2 } onde slope > 0 = subindo.
 */
export function linearTrend(values: number[]): { slope: number; intercept: number; r2: number } | null {
  const finite = values
    .map((v, i) => ({ x: i, y: v }))
    .filter((p) => Number.isFinite(p.y));
  const n = finite.length;
  if (n < 2) return null;
  const sumX = sum(finite.map((p) => p.x));
  const sumY = sum(finite.map((p) => p.y));
  const sumXY = sum(finite.map((p) => p.x * p.y));
  const sumX2 = sum(finite.map((p) => p.x * p.x));
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const muY = sumY / n;
  const ssTot = sum(finite.map((p) => (p.y - muY) ** 2));
  if (ssTot === 0) return { slope, intercept, r2: 1 };
  const ssRes = sum(finite.map((p) => (p.y - (slope * p.x + intercept)) ** 2));
  const r2 = 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/** Projeta n períodos à frente usando a tendência linear. */
export function projectLinear(values: number[], periodsAhead: number): number[] {
  const trend = linearTrend(values);
  if (!trend) return [];
  const out: number[] = [];
  for (let i = 0; i < periodsAhead; i++) {
    out.push(trend.slope * (values.length + i) + trend.intercept);
  }
  return out;
}

/** Correlação de Pearson entre duas séries. Retorna null se inviável. */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  if (mx === null || my === null) return null;
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

/**
 * Análise de Pareto. Retorna o ponto onde a soma cumulativa cruza o threshold.
 * Default: 80% do total. Retorna o número de itens que somam threshold% do total.
 */
export function paretoCut(values: number[], threshold = 0.8): { topN: number; share: number } {
  const sorted = [...values].filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => b - a);
  const total = sum(sorted);
  if (total === 0) return { topN: 0, share: 0 };
  let cum = 0;
  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i];
    if (cum / total >= threshold) {
      return { topN: i + 1, share: cum / total };
    }
  }
  return { topN: sorted.length, share: 1 };
}

/** Agrupamento + contagem (top N por contagem). */
export function topNCount<T>(items: T[], by: (item: T) => string | null | undefined, n = 5): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = by(it);
    if (k == null || k === "") continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Agrupamento + soma de uma métrica (top N por soma). */
export function topNSum<T>(
  items: T[],
  by: (item: T) => string | null | undefined,
  metric: (item: T) => number,
  n = 5,
): Array<{ key: string; total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const k = by(it);
    if (k == null || k === "") continue;
    const v = metric(it);
    const existing = map.get(k) ?? { total: 0, count: 0 };
    existing.total += Number.isFinite(v) ? v : 0;
    existing.count += 1;
    map.set(k, existing);
  }
  return [...map.entries()]
    .map(([key, { total, count }]) => ({ key, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

/** Distribuição em buckets. */
export function distribute<T>(
  items: T[],
  buckets: Array<{ label: string; predicate: (item: T) => boolean }>,
): Array<{ label: string; count: number; share: number }> {
  const total = items.length;
  return buckets.map(({ label, predicate }) => {
    const count = items.filter(predicate).length;
    return { label, count, share: total === 0 ? 0 : count / total };
  });
}
