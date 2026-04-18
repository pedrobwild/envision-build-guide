import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, Info, Sparkles, ArrowRight, RefreshCw, Brain, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatBRL";
import type { OperationsInsightsResponse } from "@/hooks/useOperationsInsights";
import type { HealthScore } from "@/hooks/useDashboardMetrics";

interface Props {
  insights: OperationsInsightsResponse | null;
  healthScore: HealthScore | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    containerClass: "border-destructive/25 bg-destructive/[0.04]",
    iconClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive",
    badgeLabel: "Crítico",
  },
  warning: {
    icon: AlertCircle,
    containerClass: "border-amber-500/25 bg-amber-500/[0.04]",
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    badgeLabel: "Atenção",
  },
  info: {
    icon: Info,
    containerClass: "border-primary/15 bg-primary/[0.03]",
    iconClass: "text-primary",
    badgeClass: "bg-primary/10 text-primary",
    badgeLabel: "Info",
  },
  opportunity: {
    icon: Sparkles,
    containerClass: "border-emerald-500/25 bg-emerald-500/[0.04]",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    badgeLabel: "Oportunidade",
  },
} as const;

const HEALTH_COLORS: Record<HealthScore["status"], { bar: string; label: string; text: string }> = {
  excellent: { bar: "bg-emerald-500", label: "Excelente", text: "text-emerald-600 dark:text-emerald-400" },
  healthy: { bar: "bg-primary", label: "Saudável", text: "text-primary" },
  warning: { bar: "bg-amber-500", label: "Atenção", text: "text-amber-600 dark:text-amber-400" },
  critical: { bar: "bg-destructive", label: "Crítico", text: "text-destructive" },
};

export function IntelligentAlertsPanel({ insights, healthScore, loading, error, onRefresh }: Props) {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with health score */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold font-display text-foreground tracking-tight">
                Análise Inteligente da Operação
              </h3>
              <p className="text-[11px] font-body text-muted-foreground mt-0.5">
                {loading ? "Gerando insights com IA…" :
                 error ? "Erro ao gerar análise" :
                 insights?.executiveSummary || "Sem dados suficientes para análise."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={onRefresh}
            disabled={loading}
            title="Atualizar análise"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Health score gauge */}
        {healthScore && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70 font-body">
                  Health Score
                </span>
                <div className="flex items-baseline gap-1.5">
                  <Activity className={`h-3 w-3 ${HEALTH_COLORS[healthScore.status].text}`} />
                  <span className={`text-xl font-bold font-mono tabular-nums ${HEALTH_COLORS[healthScore.status].text}`}>
                    {healthScore.value}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-body">/100</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ml-1 ${HEALTH_COLORS[healthScore.status].text}`}>
                    {HEALTH_COLORS[healthScore.status].label}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                {healthScore.factors.map((f) => (
                  <div
                    key={f.label}
                    className={`${HEALTH_COLORS[healthScore.status].bar} opacity-70 first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${f.contribution}%` }}
                    title={`${f.label}: ${f.contribution}/${f.weight}`}
                  />
                ))}
              </div>
              <div className="flex gap-3 mt-1.5">
                {healthScore.factors.map((f) => (
                  <span key={f.label} className="text-[9px] font-mono tabular-nums text-muted-foreground/70">
                    {f.label} {f.contribution}/{f.weight}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights list */}
      <div className="p-4">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] p-4 text-center">
            <p className="text-sm text-destructive font-body">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onRefresh}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!loading && !error && (!insights || insights.insights.length === 0) && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-center">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-body">
              Operação estável. Nenhum ponto crítico identificado.
            </p>
          </div>
        )}

        {!loading && !error && insights && insights.insights.length > 0 && (
          <div className="space-y-2">
            {insights.insights.map((ins) => {
              const config = SEVERITY_CONFIG[ins.severity];
              const Icon = config.icon;
              return (
                <div
                  key={ins.id}
                  className={`rounded-lg border p-3.5 transition-all ${config.containerClass} ${
                    ins.actionPath ? "cursor-pointer hover:shadow-sm" : ""
                  }`}
                  onClick={() => ins.actionPath && navigate(ins.actionPath)}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`px-1.5 py-px rounded text-[9px] font-semibold uppercase tracking-wider ${config.badgeClass}`}>
                          {config.badgeLabel}
                        </span>
                        {ins.affectedCount > 0 && (
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                            {ins.affectedCount} {ins.affectedCount === 1 ? "item" : "itens"}
                          </span>
                        )}
                        {ins.estimatedImpactBRL && ins.estimatedImpactBRL > 0 && (
                          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                            · impacto ~{formatBRL(ins.estimatedImpactBRL)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-body font-semibold text-foreground leading-snug">
                        {ins.title}
                      </p>
                      <p className="text-[11px] font-body text-muted-foreground leading-relaxed mt-1">
                        <span className="font-medium text-foreground/80">Causa: </span>{ins.rootCause}
                      </p>
                      <p className="text-[11px] font-body text-foreground/90 leading-relaxed mt-0.5">
                        <span className="font-medium">→ </span>{ins.recommendation}
                      </p>
                    </div>
                    {ins.actionPath && (
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 self-center" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {insights?.generatedAt && !loading && (
          <p className="text-[9px] font-mono text-muted-foreground/60 text-right mt-3">
            Análise gerada por IA · {new Date(insights.generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}
