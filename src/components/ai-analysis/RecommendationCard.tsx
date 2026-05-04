/**
 * Card de recomendação acionável.
 * Não mistura regra estatística — só renderiza.
 */

import { ArrowRight, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnalysisConfidenceBadge } from "./AnalysisConfidenceBadge";
import type { Recommendation } from "./types";

interface Props {
  recommendation: Recommendation;
  onAction?: (rec: Recommendation) => void;
}

const EFFORT_STYLE: Record<Recommendation["effort"], string> = {
  low: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  medium: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  high: "border-destructive/30 text-destructive",
};

export function RecommendationCard({ recommendation, onAction }: Props) {
  return (
    <Card className="border border-primary/20 bg-primary/[0.02]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 shrink-0">
            <Zap className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold leading-snug">{recommendation.title}</h4>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className={cn("text-[10px]", EFFORT_STYLE[recommendation.effort])}>
                  Esforço: {recommendation.effort === "low" ? "baixo" : recommendation.effort === "medium" ? "médio" : "alto"}
                </Badge>
                <AnalysisConfidenceBadge confidence={recommendation.confidence} compact />
              </div>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
              {recommendation.rationale}
            </p>
            <p className="mt-2 text-[13px] text-foreground">
              <span className="font-medium">Ação:</span> {recommendation.action}
            </p>
            {recommendation.expectedImpact && (
              <p className="mt-1 text-[11px] text-muted-foreground italic">
                Impacto esperado: {recommendation.expectedImpact}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
          <span>
            Baseada em {recommendation.basedOn.length} insight{recommendation.basedOn.length === 1 ? "" : "s"}
          </span>
          {onAction && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={() => onAction(recommendation)}
            >
              Aplicar
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
