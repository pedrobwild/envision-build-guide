import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InsightConfidence } from "./types";

const STYLES: Record<InsightConfidence, string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
};

const LABELS: Record<InsightConfidence, string> = {
  high: "Confiança alta",
  medium: "Confiança média",
  low: "Confiança baixa",
};

export interface AnalysisConfidenceBadgeProps {
  confidence: InsightConfidence;
  className?: string;
  /** mostra apenas o ponto colorido sem label. */
  compact?: boolean;
}

export function AnalysisConfidenceBadge({
  confidence,
  className,
  compact,
}: AnalysisConfidenceBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", STYLES[confidence], className)}
      aria-label={LABELS[confidence]}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          confidence === "high" && "bg-emerald-500",
          confidence === "medium" && "bg-amber-500",
          confidence === "low" && "bg-destructive",
        )}
      />
      {!compact && <span className="text-[11px] font-medium">{LABELS[confidence]}</span>}
    </Badge>
  );
}
