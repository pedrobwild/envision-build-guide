import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgingBucket, SlaRiskItem } from "@/hooks/useDashboardMetrics";

interface BacklogAgingPanelProps {
  agingBuckets: AgingBucket[];
  slaRiskItems: SlaRiskItem[];
  stalledByStage: { stage: string; label: string; count: number; avgDays: number }[];
  loading?: boolean;
}

export function BacklogAgingPanel({ agingBuckets, slaRiskItems, stalledByStage, loading }: BacklogAgingPanelProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-44 mb-4" />
        <Skeleton className="h-[160px] w-full" />
      </div>
    );
  }

  const totalBacklog = agingBuckets.reduce((sum, b) => sum + b.count, 0);
  const maxBucket = Math.max(...agingBuckets.map((b) => b.count), 1);
  const hasRisk = slaRiskItems.length > 0;
  const hasStalled = stalledByStage.length > 0;

  if (totalBacklog === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-3">
          Aging do backlog
        </h3>
        <p className="text-xs text-muted-foreground font-body py-4 text-center">
          Nenhum item em backlog
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aging Distribution */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-0.5">
          Envelhecimento do backlog
        </h3>
        <p className="text-[10px] text-muted-foreground/60 font-body mb-4">
          {totalBacklog} itens ativos por faixa de tempo
        </p>

        {/* Stacked bar */}
        <div className="h-6 rounded-lg overflow-hidden flex mb-3">
          {agingBuckets.map((bucket) => {
            const pct = (bucket.count / totalBacklog) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={bucket.label}
                className="h-full transition-all duration-500 first:rounded-l-lg last:rounded-r-lg"
                style={{ width: `${pct}%`, backgroundColor: bucket.color }}
                title={`${bucket.label}: ${bucket.count}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {agingBuckets.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: bucket.color }} />
              <span className="text-[10px] font-body text-muted-foreground">
                {bucket.label}
              </span>
              <span className="text-[10px] font-mono tabular-nums font-semibold text-foreground">
                {bucket.count}
              </span>
            </div>
          ))}
        </div>

        {/* Bar chart per bucket */}
        <div className="mt-4 space-y-1.5">
          {agingBuckets.map((bucket) => {
            if (bucket.count === 0) return null;
            const barWidth = (bucket.count / maxBucket) * 100;
            return (
              <div key={bucket.label} className="flex items-center gap-2">
                <span className="text-[10px] font-body text-muted-foreground w-16 shrink-0 text-right">
                  {bucket.label}
                </span>
                <div className="flex-1 h-3 rounded bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ width: `${barWidth}%`, backgroundColor: bucket.color }}
                  />
                </div>
                <span className="text-[10px] font-mono tabular-nums font-semibold text-foreground w-5 text-right">
                  {bucket.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stalled stages + SLA risk in a row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stalled by stage */}
        {hasStalled && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
                Tempo parado por etapa
              </h3>
            </div>

            <div className="space-y-2.5">
              {stalledByStage.map((item) => (
                <div
                  key={item.stage}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/admin/operacoes?status=${item.stage}`)}
                >
                  <div>
                    <p className="text-xs font-body font-medium text-foreground">{item.label}</p>
                    <p className="text-[10px] font-body text-muted-foreground">
                      {item.count} item{item.count > 1 ? "ns" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-mono tabular-nums font-semibold ${
                      item.avgDays > 5 ? "text-destructive" : item.avgDays > 3 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}>
                      {item.avgDays}d
                    </p>
                    <p className="text-[9px] font-body text-muted-foreground/60">média</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLA Risk */}
        {hasRisk && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
                  Risco de SLA — próximas 48h
                </h3>
              </div>
              <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">
                {slaRiskItems.length}
              </span>
            </div>

            <div className="space-y-2">
              {slaRiskItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 bg-destructive/[0.03] cursor-pointer hover:bg-destructive/[0.06] transition-colors"
                  onClick={() => navigate(`/admin/demanda/${item.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-body font-medium text-foreground truncate">
                      {item.projectName}
                    </p>
                    <p className="text-[10px] font-body text-muted-foreground truncate">
                      {item.clientName}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={`text-sm font-mono tabular-nums font-semibold ${
                      item.hoursLeft <= 24 ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {item.hoursLeft}h
                    </p>
                    <p className="text-[9px] font-body text-muted-foreground/60">restantes</p>
                  </div>
                </div>
              ))}

              {slaRiskItems.length > 5 && (
                <button
                  onClick={() => navigate("/admin/operacoes?filter=sla_risk")}
                  className="w-full flex items-center justify-center gap-1 text-[10px] font-body text-primary hover:underline py-1"
                >
                  Ver todos ({slaRiskItems.length}) <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
