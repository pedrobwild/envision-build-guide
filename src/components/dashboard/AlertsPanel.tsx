import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, Info, Sparkles, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertItem } from "@/hooks/useDashboardMetrics";

interface AlertsPanelProps {
  alerts: AlertItem[];
  loading?: boolean;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    containerClass: "border-destructive/20 bg-destructive/[0.03]",
    iconClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive text-[9px] font-semibold uppercase tracking-wider",
    badgeLabel: "Crítico",
  },
  warning: {
    icon: AlertCircle,
    containerClass: "border-amber-500/20 bg-amber-500/[0.03]",
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[9px] font-semibold uppercase tracking-wider",
    badgeLabel: "Atenção",
  },
  info: {
    icon: Info,
    containerClass: "border-primary/15 bg-primary/[0.02]",
    iconClass: "text-primary",
    badgeClass: "bg-primary/10 text-primary text-[9px] font-semibold uppercase tracking-wider",
    badgeLabel: "Info",
  },
  opportunity: {
    icon: Sparkles,
    containerClass: "border-emerald-500/20 bg-emerald-500/[0.03]",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold uppercase tracking-wider",
    badgeLabel: "Oportunidade",
  },
};

export function AlertsPanel({ alerts, loading }: AlertsPanelProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
            Centro de alertas
          </h3>
        </div>
        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-body mt-3">
          Nenhum alerta no momento. Operação estável.
        </p>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {criticalCount > 0 && <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
          {criticalCount === 0 && warningCount > 0 && <div className="h-2 w-2 rounded-full bg-amber-500" />}
          {criticalCount === 0 && warningCount === 0 && <div className="h-2 w-2 rounded-full bg-primary" />}
          <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
            Centro de alertas e ações pendentes
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive text-[9px] font-semibold font-mono tabular-nums">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[9px] font-semibold font-mono tabular-nums">
              {warningCount} atenção
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {alerts.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity];
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`rounded-lg border p-3 transition-all ${config.containerClass} ${
                alert.actionPath ? "cursor-pointer hover:shadow-sm" : ""
              }`}
              onClick={() => {
                if (alert.actionPath) {
                  const params = new URLSearchParams(alert.actionQuery || {});
                  navigate(`${alert.actionPath}${params.toString() ? `?${params}` : ""}`);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`px-1.5 py-px rounded ${config.badgeClass}`}>
                      {config.badgeLabel}
                    </span>
                    {alert.count !== undefined && (
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                        ({alert.count})
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-body font-medium text-foreground leading-snug">
                    {alert.title}
                  </p>
                  <p className="text-[11px] font-body text-muted-foreground leading-snug mt-0.5">
                    {alert.description}
                  </p>
                </div>
                {alert.actionLabel && (
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <span className="text-[10px] font-body font-medium text-primary hidden sm:inline">
                      {alert.actionLabel}
                    </span>
                    <ArrowRight className="h-3 w-3 text-primary" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
