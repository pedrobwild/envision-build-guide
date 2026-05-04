/**
 * Card que renderiza um AdvancedInsight com:
 *  - badge de natureza (fact/inference/hypothesis)
 *  - badge de confiança
 *  - evidence list
 *  - chart opcional via ChartRecommendationPanel (lazy)
 *  - bloco "Limitações" e link "ver origem" (provenance)
 *
 * Componente NÃO faz cálculo. Só exibe.
 */

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  FileSearch,
  Info,
  Lightbulb,
  Microscope,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AdvancedInsight,
  ClaimNature,
  DataQualitySeverity,
  InsightConfidence,
} from "./types";
import { AnalysisConfidenceBadge } from "./AnalysisConfidenceBadge";

interface Props {
  insight: AdvancedInsight;
  /** Chart já renderizado pelo caller (opcional). */
  chartSlot?: React.ReactNode;
}

const NATURE_STYLE: Record<ClaimNature, string> = {
  fact: "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-700 dark:text-emerald-400",
  inference: "border-blue-500/30 bg-blue-500/[0.05] text-blue-700 dark:text-blue-400",
  hypothesis: "border-purple-500/30 bg-purple-500/[0.05] text-purple-700 dark:text-purple-400",
};

const NATURE_LABEL: Record<ClaimNature, string> = {
  fact: "Fato",
  inference: "Inferência",
  hypothesis: "Hipótese",
};

const NATURE_ICON: Record<ClaimNature, typeof Info> = {
  fact: Quote,
  inference: Microscope,
  hypothesis: Lightbulb,
};

const SEVERITY_BORDER: Record<DataQualitySeverity, string> = {
  critical: "border-destructive/30",
  warning: "border-amber-500/30",
  info: "border-border",
};

export function AdvancedInsightCard({ insight, chartSlot }: Props) {
  const [showProvenance, setShowProvenance] = useState(false);
  const NatureIcon = NATURE_ICON[insight.nature];

  return (
    <Card className={cn("border", SEVERITY_BORDER[insight.severity])}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3 justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {insight.title}
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              {insight.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={cn("gap-1", NATURE_STYLE[insight.nature])}>
              <NatureIcon className="h-3 w-3" aria-hidden />
              <span className="text-[11px] font-medium">{NATURE_LABEL[insight.nature]}</span>
            </Badge>
            <AnalysisConfidenceBadge confidence={insight.confidence} compact />
          </div>
        </div>

        {/* Evidence */}
        {insight.evidence.length > 0 && (
          <div className="rounded-md bg-muted/30 p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
            {insight.evidence.map((e, i) => (
              <div key={i} className="text-[12px]">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {e.label}
                </div>
                <div className="font-mono tabular-nums text-foreground">
                  {typeof e.value === "number" ? formatNumber(e.value) : e.value}
                  {e.unit && <span className="text-muted-foreground ml-1">{e.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chart slot */}
        {chartSlot && <div className="rounded-md border bg-card/50">{chartSlot}</div>}

        {/* Limitations */}
        {insight.limitations && insight.limitations.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.05] p-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <ul className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
              {insight.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Provenance toggle */}
        <div className="pt-1 border-t flex items-center justify-between text-[10px] text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => setShowProvenance((v) => !v)}
            aria-expanded={showProvenance}
          >
            <FileSearch className="h-3 w-3" />
            {showProvenance ? "Ocultar origem" : "Ver origem do cálculo"}
          </Button>
          <span className="font-mono">id: {insight.id}</span>
        </div>

        {showProvenance && (
          <div className="rounded-md border bg-muted/30 p-2.5 text-[11px] font-mono space-y-1">
            <div>
              <span className="text-muted-foreground">source:</span> {insight.provenance.source}
            </div>
            <div>
              <span className="text-muted-foreground">datasetId:</span> {insight.provenance.datasetId}
            </div>
            <div>
              <span className="text-muted-foreground">columns:</span>{" "}
              {insight.provenance.columns.join(", ") || "—"}
            </div>
            {insight.provenance.params && Object.keys(insight.provenance.params).length > 0 && (
              <div>
                <span className="text-muted-foreground">params:</span>{" "}
                <code className="text-[10px]">{JSON.stringify(insight.provenance.params)}</code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

// Wrapper opcional pra mostrar severity em UI (dual-use no painel)
export function severityIcon(severity: DataQualitySeverity): typeof Info {
  if (severity === "critical") return AlertTriangle;
  if (severity === "warning") return AlertCircle;
  return Info;
}

// Re-export helpers for ext callers
export type { InsightConfidence };
