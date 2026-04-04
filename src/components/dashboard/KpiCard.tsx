import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { KpiData } from "@/hooks/useDashboardMetrics";

interface KpiCardProps {
  label: string;
  kpi: KpiData;
  format?: "number" | "percent" | "currency" | "days";
  tooltip?: string;
  /** If true, "down" trend is positive (e.g. lead time, overdue) */
  invertTrend?: boolean;
  loading?: boolean;
  alert?: boolean;
}

function formatValue(value: number | null, fmt: string): string {
  if (value === null) return "—";
  switch (fmt) {
    case "currency":
      if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${value.toFixed(0)} dias`;
    default:
      return value.toLocaleString("pt-BR");
  }
}

export function KpiCard({ label, kpi, format: fmt = "number", tooltip, invertTrend, loading, alert }: KpiCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  const isPositive = invertTrend ? kpi.trend === "down" : kpi.trend === "up";
  const isNegative = invertTrend ? kpi.trend === "up" : kpi.trend === "down";

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-all hover:shadow-sm ${
        alert
          ? "border-destructive/30 bg-destructive/[0.02]"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body leading-none">
          {label}
        </span>
        {tooltip && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-xs font-body">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="font-display text-2xl font-semibold text-foreground tracking-tight leading-none mb-2 tabular-nums font-mono">
        {formatValue(kpi.value, fmt)}
      </div>

      {kpi.change !== null && (
        <div className="flex items-center gap-1.5">
          {isPositive && <TrendingUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
          {isNegative && <TrendingDown className="h-3 w-3 text-destructive" />}
          {kpi.trend === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
          <span
            className={`text-[11px] font-body font-medium tabular-nums ${
              isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : isNegative
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {kpi.change > 0 ? "+" : ""}
            {kpi.change.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-body">vs anterior</span>
        </div>
      )}

      {kpi.change === null && kpi.value !== null && (
        <div className="h-4" /> 
      )}
    </div>
  );
}

export function KpiCardCompact({
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value: string;
  subtitle?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold font-mono tabular-nums text-foreground">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground font-body mt-0.5">{subtitle}</p>}
    </div>
  );
}
