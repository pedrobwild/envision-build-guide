/**
 * Forecast linear simples com intervalo de confiança 95%.
 *
 * Diferença em relação ao `projectLinear` legado:
 *  - retorna intervalo de confiança
 *  - registra `caveat` quando r² baixo ou n curto
 *  - aceita granularidade (day/week/month) e gera timestamps futuros
 */

import type {
  ForecastPoint,
  ForecastResult,
} from "@/components/ai-analysis/types";
import { linearRegression, mean } from "./statistics-core";
import type { Granularity } from "./temporal";

const Z_95 = 1.96;

const GRANULARITY_MS: Record<Granularity, number> = {
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

function isoOf(ms: number, granularity: Granularity): string {
  const d = new Date(ms);
  if (granularity === "month") return d.toISOString().slice(0, 7);
  return d.toISOString().slice(0, 10);
}

export interface ForecastOptions {
  /** quantos períodos à frente projetar. default 7. */
  periodsAhead?: number;
  /** granularidade. default 'day'. */
  granularity?: Granularity;
  /** N mínimo no histórico. default 5. */
  minHistory?: number;
}

export function forecastSeries(
  history: ReadonlyArray<{ t: string; value: number }>,
  metric: string,
  timeColumn: string,
  options: ForecastOptions = {},
): ForecastResult {
  const periodsAhead = options.periodsAhead ?? 7;
  const granularity = options.granularity ?? "day";
  const minHistory = options.minHistory ?? 5;

  if (history.length < minHistory) {
    return {
      metric,
      timeColumn,
      granularity,
      history: [...history],
      forecast: [],
      r2: null,
      caveat: `Histórico curto (${history.length} pontos) — projeção não calculada. Mínimo necessário: ${minHistory}.`,
    };
  }

  const xs = history.map((_, i) => i);
  const ys = history.map((p) => p.value);
  const fit = linearRegression(xs, ys);
  if (!fit) {
    return {
      metric,
      timeColumn,
      granularity,
      history: [...history],
      forecast: [],
      r2: null,
      caveat: "Falha ao ajustar regressão (variância zero em x).",
    };
  }

  const lastT = history[history.length - 1]?.t;
  if (!lastT) {
    return {
      metric,
      timeColumn,
      granularity,
      history: [...history],
      forecast: [],
      r2: fit.r2,
      caveat: "Histórico sem timestamp final.",
    };
  }

  const lastMs = Date.parse(lastT.length === 7 ? `${lastT}-01` : lastT);
  const stepMs = GRANULARITY_MS[granularity];
  const muY = mean(ys) ?? 0;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const meanX = sumX / xs.length;
  let sxx = 0;
  for (const x of xs) sxx += (x - meanX) ** 2;

  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= periodsAhead; i++) {
    const xFuture = history.length - 1 + i;
    const yhat = fit.slope * xFuture + fit.intercept;
    // CI da predição: se * sqrt(1 + 1/n + (x-mean)²/Sxx)
    const ciTerm = sxx === 0 ? 0 : (xFuture - meanX) ** 2 / sxx;
    const sePred = fit.residualStd * Math.sqrt(1 + 1 / fit.n + ciTerm);
    const half = Z_95 * sePred;
    forecast.push({
      t: isoOf(lastMs + i * stepMs, granularity),
      value: yhat,
      lower: yhat - half,
      upper: yhat + half,
    });
  }

  let caveat: string | undefined;
  if (fit.r2 < 0.3) caveat = `Ajuste linear fraco (r²=${fit.r2.toFixed(2)}) — projeção altamente incerta. Use só como ordem de grandeza, não como meta.`;
  else if (fit.r2 < 0.6) caveat = `Ajuste linear moderado (r²=${fit.r2.toFixed(2)}). Considere modelos não-lineares para horizontes maiores.`;
  else if (history.length < 20) caveat = `Histórico relativamente curto (${history.length} pontos). Reavalie quando houver mais dados.`;

  // ignoramos muY se não for útil — apenas placeholder pra evitar warning de var não-usada
  void muY;

  return {
    metric,
    timeColumn,
    granularity,
    history: [...history],
    forecast,
    r2: fit.r2,
    caveat,
  };
}
