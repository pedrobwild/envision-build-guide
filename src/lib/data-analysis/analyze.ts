/**
 * Orquestrador principal: recebe `AnalysisRequest` e devolve `AnalysisResult`
 * 100% calculado (sem IA).
 *
 * O LLM, em outra camada, recebe ESTE resultado e gera narrativa. A separação
 * garante que números nunca são "inventados".
 */

import type {
  AdvancedInsight,
  AnalysisRequest,
  AnalysisResult,
  ChartSpec,
  ForecastResult,
  InsightConfidence,
  Recommendation,
} from "@/components/ai-analysis/types";
import { summarizeAll } from "./summary";
import { correlationMatrix } from "./correlation";
import { detectTrends } from "./temporal";
import { detectAnomalies } from "./anomalies";
import { forecastSeries } from "./forecast";

function chartFromTrend(trend: ReturnType<typeof detectTrends>[number]): ChartSpec | null {
  if (trend.series.length < 2) return null;
  return {
    type: "line",
    title: `${trend.metric} ao longo do tempo (${trend.granularity})`,
    encoding: { x: "t", y: "value" },
    data: trend.series.map((p) => ({ t: p.t, value: p.value })),
    rationale: "Série temporal — tendência detectada por regressão linear.",
  };
}

function chartFromTopK(label: string, top: Array<{ value: string; count: number }>): ChartSpec {
  return {
    type: "horizontal_bar",
    title: `Top ${top.length} – ${label}`,
    encoding: { x: "count", y: "value" },
    data: top.map((t) => ({ value: t.value, count: t.count })),
    rationale: "Ranking por contagem — útil para identificar concentração.",
  };
}

function aggregateConfidence(parts: number[]): InsightConfidence {
  if (parts.length === 0) return "low";
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  if (avg >= 0.75) return "high";
  if (avg >= 0.5) return "medium";
  return "low";
}

export function analyze(request: AnalysisRequest): AnalysisResult {
  const { dataset } = request;
  const opts = request.options ?? {};
  const generatedAt = new Date().toISOString();

  // 1. Resumos
  const summaries = summarizeAll(dataset.columns, dataset.rows, {
    topK: opts.topK,
    focus: request.focusColumns,
  });

  // 2. Correlação
  const corr = correlationMatrix(dataset.columns, dataset.rows, {
    minSample: opts.minSampleForCorrelation,
  });

  // 3. Tendências
  const trends = detectTrends(dataset.columns, dataset.rows, {
    granularity: opts.timeGranularity,
  });

  // 4. Anomalias
  const anomalies = detectAnomalies(dataset.columns, dataset.rows);

  // 5. Forecast (apenas se solicitado)
  const forecasts: ForecastResult[] = [];
  if (opts.enableForecast) {
    for (const t of trends) {
      if (t.series.length < 5) continue;
      forecasts.push(
        forecastSeries(t.series, t.metric, t.timeColumn, {
          granularity: t.granularity,
        }),
      );
    }
  }

  // 6. Insights estruturados (calculados, não LLM)
  const insights: AdvancedInsight[] = [];
  const charts: ChartSpec[] = [];
  const limitations: string[] = [];
  const confidenceParts: number[] = [];

  // 6.1 Trends → insights
  for (const t of trends) {
    if (t.direction === "insufficient" || t.direction === "noisy") continue;
    const slopeRounded = t.slope === null ? "—" : t.slope.toFixed(2);
    const r2Rounded = t.r2 === null ? "—" : t.r2.toFixed(2);
    const conf: InsightConfidence = (t.r2 ?? 0) >= 0.6 ? "high" : (t.r2 ?? 0) >= 0.3 ? "medium" : "low";
    confidenceParts.push(conf === "high" ? 0.85 : conf === "medium" ? 0.55 : 0.3);
    const chart = chartFromTrend(t);
    if (chart) charts.push(chart);
    insights.push({
      id: `trend:${t.timeColumn}:${t.metric}`,
      title: `${t.metric}: tendência ${t.direction === "up" ? "de alta" : t.direction === "down" ? "de queda" : "estável"}`,
      description: `Regressão linear sobre ${t.series.length} pontos (${t.granularity}) indica direção ${t.direction} (slope=${slopeRounded}/${t.granularity}, r²=${r2Rounded}).`,
      nature: "fact",
      confidence: conf,
      severity: t.direction === "down" ? "warning" : "info",
      evidence: [
        { label: "Pontos", value: t.series.length },
        { label: "Slope", value: t.slope ?? "—", unit: `/${t.granularity}` },
        { label: "R²", value: t.r2 ?? "—" },
      ],
      provenance: {
        source: "detectTrends/linearRegression",
        datasetId: dataset.id,
        columns: [t.timeColumn, t.metric],
        params: { granularity: t.granularity },
      },
      chart: chart ?? undefined,
      limitations: (t.r2 ?? 0) < 0.3 ? ["Ajuste linear fraco — interprete a direção apenas qualitativamente."] : undefined,
    });
  }

  // 6.2 Correlação → insights de pares fortes
  if (corr) {
    for (const p of corr.topPairs.slice(0, 5)) {
      if (p.strength === "weak") continue;
      const conf: InsightConfidence = p.strength === "strong" ? "high" : "medium";
      confidenceParts.push(conf === "high" ? 0.85 : 0.55);
      insights.push({
        id: `corr:${p.a}:${p.b}`,
        title: `Correlação ${p.strength === "strong" ? "forte" : "moderada"} entre ${p.a} e ${p.b}`,
        description: `Coeficiente de Pearson r=${p.r.toFixed(2)} sobre n=${p.n}. Lembre-se: correlação não implica causalidade.`,
        nature: "inference",
        confidence: conf,
        severity: "info",
        evidence: [
          { label: "r", value: Number(p.r.toFixed(3)) },
          { label: "n", value: p.n },
        ],
        provenance: {
          source: "correlationMatrix/pearson",
          datasetId: dataset.id,
          columns: [p.a, p.b],
        },
        limitations: ["Correlação ≠ causalidade. Verifique fatores confounders antes de agir."],
      });
    }
  } else if (dataset.columns.filter((c) => ["number", "integer", "currency", "percent"].includes(c.kind)).length >= 2) {
    limitations.push("Correlações não calculadas: amostra insuficiente após remover nulls.");
  }

  // 6.3 Anomalias → 1 insight agregador
  if (anomalies.length > 0) {
    const byCol = new Map<string, number>();
    for (const a of anomalies) byCol.set(a.column, (byCol.get(a.column) ?? 0) + 1);
    insights.push({
      id: `anomalies:${anomalies.length}`,
      title: `${anomalies.length} anomalias detectadas`,
      description: `Pontos fora do padrão IQR/zscore em ${byCol.size} coluna(s): ${[...byCol.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}.`,
      nature: "fact",
      confidence: "high",
      severity: "warning",
      evidence: [{ label: "Total", value: anomalies.length }],
      provenance: {
        source: "detectAnomalies",
        datasetId: dataset.id,
        columns: [...byCol.keys()],
        params: { method: "iqr+zscore" },
      },
      limitations: ["Anomalia estatística não significa erro — investigue antes de remover."],
    });
    confidenceParts.push(0.8);
  }

  // 6.4 Top categorias → charts auxiliares
  for (const s of summaries) {
    if (s.kind === "categorical" && s.top.length > 0 && s.uniqueCount > 1) {
      charts.push(chartFromTopK(s.column, s.top.slice(0, 8)));
    }
  }

  // 7. Recomendações automáticas (sem IA): heurísticas determinísticas
  const recommendations: Recommendation[] = [];
  for (const ins of insights) {
    if (ins.severity !== "warning") continue;
    if (ins.id.startsWith("trend:") && ins.title.includes("queda")) {
      recommendations.push({
        id: `rec:${ins.id}`,
        title: `Investigar queda em ${ins.provenance.columns[1]}`,
        rationale: `Tendência de queda detectada com confiança ${ins.confidence}.`,
        action: `Avaliar drivers de ${ins.provenance.columns[1]} no período e definir métricas de monitoramento.`,
        effort: "medium",
        basedOn: [ins.id],
        confidence: ins.confidence,
      });
    }
    if (ins.id.startsWith("anomalies:")) {
      recommendations.push({
        id: `rec:${ins.id}`,
        title: "Revisar pontos anômalos antes de relatórios",
        rationale: "Anomalias podem distorcer médias e relatórios executivos.",
        action: "Auditar manualmente as linhas marcadas como anomalia.",
        effort: "low",
        basedOn: [ins.id],
        confidence: "medium",
      });
    }
  }

  return {
    datasetId: dataset.id,
    generatedAt,
    summaries,
    correlations: corr,
    trends,
    anomalies,
    forecasts,
    insights,
    recommendations,
    charts,
    confidence: aggregateConfidence(confidenceParts),
    limitations,
    filtersApplied: opts.appliedFilters ?? {},
  };
}
