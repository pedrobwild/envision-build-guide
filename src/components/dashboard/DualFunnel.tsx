import { useNavigate } from "react-router-dom";
import { ArrowDown, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FunnelStage } from "@/hooks/useDashboardMetrics";
import { buildDashboardUrlForStatus } from "@/lib/commercial-dashboard-url";

interface DualFunnelProps {
  operationalFunnel: FunnelStage[];
  commercialFunnel: FunnelStage[];
  loading?: boolean;
}

function FunnelSection({
  title,
  subtitle,
  stages,
  accentColor,
  onStageClick,
}: {
  title: string;
  subtitle: string;
  stages: FunnelStage[];
  accentColor: string;
  onStageClick?: (stage: FunnelStage) => void;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-0.5">
        {title}
      </h3>
      <p className="text-[10px] text-muted-foreground/60 font-body mb-4">
        {subtitle}
      </p>

      <div className="space-y-1">
        {stages.map((stage, i) => {
          const barWidth = Math.max((stage.count / maxCount) * 100, 4);
          const isFirst = i === 0;

          return (
            <div key={stage.key}>
              {/* Pass rate indicator between stages */}
              {!isFirst && stage.passRate !== null && (
                <div className="flex items-center gap-1.5 py-1 pl-2">
                  <ArrowDown className="h-2.5 w-2.5 text-muted-foreground/40" />
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground/50">
                    {stage.passRate}% passagem
                  </span>
                  {stage.drop > 0 && (
                    <span className="text-[9px] font-mono tabular-nums text-muted-foreground/40 flex items-center gap-0.5">
                      <TrendingDown className="h-2 w-2" />
                      −{stage.drop}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  onStageClick ? "cursor-pointer hover:bg-muted/50" : ""
                }`}
                onClick={() => onStageClick?.(stage)}
              >
                <div className="w-24 shrink-0">
                  <span className="text-xs font-body text-foreground font-medium">
                    {stage.label}
                  </span>
                </div>

                <div className="flex-1 h-5 rounded bg-muted/50 overflow-hidden relative">
                  <div
                    className="h-full rounded transition-all duration-700 ease-out"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: accentColor,
                      opacity: 0.15 + (0.85 * (1 - i / Math.max(stages.length - 1, 1))),
                    }}
                  />
                </div>

                <span className="text-sm font-mono tabular-nums font-semibold text-foreground w-8 text-right">
                  {stage.count}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DualFunnel({ operationalFunnel, commercialFunnel, loading }: DualFunnelProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FunnelSection
        title="Funil operacional"
        subtitle="Do recebimento à entrega ao comercial"
        stages={operationalFunnel}
        accentColor="#0070F3"
        onStageClick={(stage) => navigate(`/admin/operacoes?status=${stage.key}`)}
      />
      <FunnelSection
        title="Funil comercial"
        subtitle="Do envio ao contrato fechado"
        stages={commercialFunnel}
        accentColor="#10b981"
        onStageClick={(stage) => navigate(buildDashboardUrlForStatus(stage.key))}
      />
    </div>
  );
}
