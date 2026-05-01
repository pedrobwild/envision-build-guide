/**
 * MetricTile — KPI premium (Atlassian/Stripe-style).
 *
 * Hierarquia maior que o KpiCard antigo: número grande em mono (28-32px),
 * label discreta acima, delta + sparkline embaixo. Health dot opcional
 * à esquerda do label como reforço semântico não-cromático.
 *
 * Reaproveita o tipo KpiData/KpiMeta para integração drop-in.
 */

import { TrendingUp, TrendingDown, Minus, Info, ArrowUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { KpiData, KpiMeta } from "@/hooks/useDashboardMetrics";

interface MetricTileProps {
  label: string;
  kpi: KpiData;
  meta?: KpiMeta;
  format?: "number" | "percent" | "currency" | "days";
  tooltip?: string;
  invertTrend?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

const HEALTH_DOT: Record<string, string> = {
  healthy: "bg-[hsl(var(--success))]",
  warning: "bg-warn",
  critical: "bg-danger",
};

const HEALTH_RAIL: Record<string, string> = {
  healthy: "bg-[hsl(var(--success))]",
  warning: "bg-warn",
  critical: "bg-danger",
};

function formatValue(value: number | null, fmt: string): string {
  if (value === null) return "—";
  switch (fmt) {
    case "currency":
      if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${value.toFixed(0)}d`;
    default:
      return value.toLocaleString("pt-BR");
  }
}

function Sparkline({ data, tone }: { data: number[]; tone: "up" | "down" | "neutral" }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 72;
  const h = 22;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke =
    tone === "down" ? "hsl(var(--danger))" : tone === "up" ? "hsl(var(--success))" : "hsl(var(--ink-soft))";
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
    </svg>
  );
}

export function MetricTile({
  label,
  kpi,
  meta,
  format = "number",
  tooltip,
  invertTrend,
  loading,
  onClick,
}: MetricTileProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-5 space-y-3 shadow-card">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  const isPositive = invertTrend ? kpi.trend === "down" : kpi.trend === "up";
  const isNegative = invertTrend ? kpi.trend === "up" : kpi.trend === "down";
  const sparkTone = isPositive ? "up" : isNegative ? "down" : "neutral";
  const health = meta?.health;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative w-full text-left rounded-2xl border border-hairline bg-surface-1 p-5 shadow-card transition-all overflow-hidden",
        onClick && "hover:border-hairline-strong hover:shadow-raised hover:-translate-y-px cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      {/* Health rail (esquerda) — não-cromático, reforço semântico */}
      {health && (
        <span
          className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full", HEALTH_RAIL[health])}
          aria-hidden
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {health && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", HEALTH_DOT[health])} aria-hidden />}
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft font-body truncate">
            {label}
          </span>
        </div>
        {tooltip && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-ink-faint cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs font-body">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="font-mono font-semibold text-[28px] sm:text-[30px] text-ink-strong tracking-tight leading-none tabular-nums">
          {formatValue(kpi.value, format)}
        </div>
        {kpi.sparkline && kpi.sparkline.length > 1 && (
          <Sparkline data={kpi.sparkline} tone={sparkTone} />
        )}
      </div>

      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        <div className="flex items-center gap-1.5">
          {kpi.change !== null && (
            <>
              {isPositive && <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--success))]" />}
              {isNegative && <TrendingDown className="h-3.5 w-3.5 text-danger" />}
              {kpi.trend === "stable" && <Minus className="h-3.5 w-3.5 text-ink-faint" />}
              <span
                className={cn(
                  "text-[12px] font-mono font-medium tabular-nums",
                  isPositive && "text-[hsl(var(--success))]",
                  isNegative && "text-danger",
                  kpi.trend === "stable" && "text-ink-soft",
                )}
              >
                {kpi.change > 0 ? "+" : ""}
                {kpi.change.toFixed(1)}%
              </span>
              <span className="text-[11px] text-ink-faint font-body">vs. anterior</span>
            </>
          )}
          {kpi.change === null && meta?.target && (
            <span className="text-[11px] text-ink-soft font-body">Meta {meta.target}</span>
          )}
        </div>
        {onClick && (
          <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-ink-strong transition-colors" />
        )}
      </div>

      {meta?.microText && (
        <p className="text-[11px] text-ink-soft font-body leading-snug mt-2 line-clamp-1">
          {meta.microText}
        </p>
      )}
    </button>
  );
}
