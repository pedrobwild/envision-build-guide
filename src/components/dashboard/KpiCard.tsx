import { TrendingUp, TrendingDown, Minus, Info, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { KpiData, KpiMeta, HealthStatus } from "@/hooks/useDashboardMetrics";

interface KpiCardProps {
  label: string;
  kpi: KpiData;
  meta?: KpiMeta;
  format?: "number" | "percent" | "currency" | "days";
  tooltip?: string;
  invertTrend?: boolean;
  loading?: boolean;
  alert?: boolean;
  onClick?: () => void;
}

const HEALTH_STYLES: Record<string, { border: string; dot: string }> = {
  healthy: { border: "border-emerald-500/20", dot: "bg-emerald-500" },
  warning: { border: "border-amber-500/30", dot: "bg-amber-500" },
  critical: { border: "border-destructive/30", dot: "bg-destructive" },
};

function Sparkline({ data, positive, negative }: { data: number[]; positive?: boolean; negative?: boolean }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 64;
  const h = 20;
  const pad = 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const stroke = negative
    ? "hsl(var(--destructive))"
    : positive
    ? "hsl(142 71% 45%)"
    : "hsl(var(--muted-foreground) / 0.4)";

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={points.at(-1)?.split(",")[0]} cy={points.at(-1)?.split(",")[1]} r={2} fill={stroke} />
    </svg>
  );
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

export function KpiCard({ label, kpi, meta, format: fmt = "number", tooltip, invertTrend, loading, alert, onClick }: KpiCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-2 w-32" />
      </div>
    );
  }

  const isPositive = invertTrend ? kpi.trend === "down" : kpi.trend === "up";
  const isNegative = invertTrend ? kpi.trend === "up" : kpi.trend === "down";

  const health = meta?.health ?? (alert ? "critical" : null);
  const healthStyle = health ? HEALTH_STYLES[health] : null;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 transition-all hover:shadow-sm ${
        onClick ? "cursor-pointer hover:border-primary/30 active:scale-[0.99]" : ""
      } ${healthStyle?.border ?? (alert ? "border-destructive/30 bg-destructive/[0.02]" : "border-border")}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {health && (
            <div className={`h-1.5 w-1.5 rounded-full ${healthStyle?.dot} shrink-0`} />
          )}
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body leading-none">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {meta?.target && (
            <span className="text-[9px] font-mono tabular-nums text-muted-foreground/50 leading-none">
              Meta {meta.target}
            </span>
          )}
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
          {onClick && (
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/30" />
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 mb-2">
        <div className="font-display text-2xl font-semibold text-foreground tracking-tight leading-none tabular-nums font-mono">
          {formatValue(kpi.value, fmt)}
        </div>
        {kpi.sparkline && kpi.sparkline.length > 1 && (
          <Sparkline data={kpi.sparkline} positive={!invertTrend ? isPositive : isNegative} negative={!invertTrend ? isNegative : isPositive} />
        )}
      </div>

      {kpi.change !== null && (
        <div className="flex items-center gap-1.5 mb-1.5">
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
        <div className="h-4 mb-1.5" />
      )}

      {meta?.microText && (
        <p className="text-[10px] text-muted-foreground/60 font-body leading-snug line-clamp-1">
          {meta.microText}
        </p>
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
