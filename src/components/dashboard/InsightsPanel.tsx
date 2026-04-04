import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { Insight } from "@/hooks/useDashboardMetrics";

interface InsightsPanelProps {
  insights: Insight[];
  loading?: boolean;
}

export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  const iconMap = {
    positive: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    negative: <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />,
    neutral: <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-4">
        Insights e pontos de atenção
      </h3>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {iconMap[insight.type]}
            <p className="text-sm font-body text-foreground leading-snug">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
