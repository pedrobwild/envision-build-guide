/**
 * Painel principal v2 da camada de análise avançada.
 *
 * Diferente do AiAnalysisPanel original, ele:
 *  - opera sobre `AnalysisResult` + `DataQualityReport` PRÉ-CALCULADOS
 *    (não chama LLM nem faz fetch).
 *  - exibe quality, summary, insights, charts, recommendations e
 *    interpretação opcional vinda da edge function.
 *  - destaca confidence agregada com AnalysisConfidenceBadge.
 *
 * Não acopla a hook nenhum — recebe tudo via props para manter
 * testabilidade e permitir uso em storybook ou em modo offline.
 */

import { Brain, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AnalysisResult,
  AiInterpretation,
  DataQualityReport,
} from "./types";
import { DataQualityPanel } from "./DataQualityPanel";
import { StatisticalSummaryPanel } from "./StatisticalSummaryPanel";
import { AdvancedInsightCard } from "./AdvancedInsightCard";
import { RecommendationCard } from "./RecommendationCard";
import { ChartRecommendationPanel } from "./ChartRecommendationPanel";
import { AnalysisConfidenceBadge } from "./AnalysisConfidenceBadge";

interface Props {
  analysis: AnalysisResult | null;
  quality: DataQualityReport | null;
  interpretation?: AiInterpretation | null;
  loading?: boolean;
  error?: string | null;
}

export function AdvancedAnalysisPanel({
  analysis,
  quality,
  interpretation,
  loading,
  error,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </CardContent>
      </Card>
    );
  }
  if (!analysis) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Nenhuma análise disponível. Forneça um dataset.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header global */}
      <Card>
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">Análise avançada</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {interpretation?.executiveSummary ??
                  "Calculado localmente a partir do dataset. A IA, quando disponível, apenas interpreta — nunca recalcula."}
              </p>
            </div>
          </div>
          <AnalysisConfidenceBadge confidence={analysis.confidence} />
        </CardContent>
      </Card>

      {/* Quality + summary lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataQualityPanel report={quality} />
        <StatisticalSummaryPanel summaries={analysis.summaries} />
      </div>

      {/* Charts */}
      <ChartRecommendationPanel charts={analysis.charts} />

      {/* Insights */}
      {analysis.insights.length > 0 && (
        <section aria-labelledby="advanced-insights" className="space-y-2">
          <h3 id="advanced-insights" className="text-sm font-semibold text-foreground">
            Achados
          </h3>
          <div className="space-y-2">
            {analysis.insights.map((insight) => (
              <AdvancedInsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* AI key findings */}
      {interpretation && interpretation.keyFindings.length > 0 && (
        <section aria-labelledby="ai-findings" className="space-y-2">
          <h3 id="ai-findings" className="text-sm font-semibold text-foreground">
            Interpretação da IA (referenciada por insight)
          </h3>
          <ul className="space-y-2">
            {interpretation.keyFindings.map((f, i) => (
              <li key={i} className="rounded-md border bg-card p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium">{f.title}</h4>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {f.nature}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground">{f.description}</p>
                <div className="text-[10px] font-mono text-muted-foreground">
                  Refs: {f.backedBy.join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <section aria-labelledby="recs" className="space-y-2">
          <h3 id="recs" className="text-sm font-semibold text-foreground">
            Recomendações
          </h3>
          <div className="space-y-2">
            {analysis.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        </section>
      )}

      {/* Limitations */}
      {(analysis.limitations.length > 0 || (interpretation?.limitations.length ?? 0) > 0) && (
        <Card>
          <CardContent className="p-3 text-[11px] text-muted-foreground">
            <div className="font-medium uppercase tracking-wide mb-1">Limitações</div>
            <ul className="space-y-0.5">
              {analysis.limitations.map((l, i) => (
                <li key={`a-${i}`}>• {l}</li>
              ))}
              {interpretation?.limitations.map((l, i) => (
                <li key={`i-${i}`}>• {l}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
