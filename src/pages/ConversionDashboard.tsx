import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, FileCheck, Send, Trophy, AlertCircle } from "lucide-react";
import { useCommercialConversion, type ConversionRange } from "@/hooks/useCommercialConversion";
import { ConversionFunnelChart } from "@/components/dashboard/ConversionFunnelChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const RANGE_LABELS: Record<ConversionRange, string> = {
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Tudo",
};

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "default" | "success" | "warning";
  loading?: boolean;
}

function KpiCard({ label, value, hint, icon: Icon, tone = "default", loading }: KpiCardProps) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-orange-600 dark:text-orange-400"
        : "text-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
          {label}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground/60" />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <p className={`text-2xl sm:text-3xl font-semibold font-mono tabular-nums ${toneClass}`}>
          {value}
        </p>
      )}
      {hint && !loading && (
        <p className="text-[11px] text-muted-foreground/80 font-body mt-1.5">{hint}</p>
      )}
    </div>
  );
}

export default function ConversionDashboard() {
  const [range, setRange] = useState<ConversionRange>("30d");
  const { data, isLoading, error } = useCommercialConversion(range);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Link
              to="/admin/comercial"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body mb-2 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Voltar ao pipeline
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold font-display text-foreground">
              Conversão do pipeline
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Acompanhe quantos leads viram orçamento, foram enviados e fecharam contrato
            </p>
          </div>

          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as ConversionRange)}
            className="self-start sm:self-end"
          >
            {(Object.keys(RANGE_LABELS) as ConversionRange[]).map((r) => (
              <ToggleGroupItem
                key={r}
                value={r}
                className="text-xs font-body data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {RANGE_LABELS[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Erro */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive font-body">
                Não foi possível carregar as métricas
              </p>
              <p className="text-xs text-muted-foreground font-body mt-1">
                {(error as Error).message}
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Leads no período"
            value={data?.totalLeads.toString() ?? "—"}
            hint={data?.daysInWindow ? `Janela de ${data.daysInWindow} dias` : undefined}
            icon={TrendingUp}
            loading={isLoading}
          />
          <KpiCard
            label="Virou orçamento"
            value={
              data
                ? `${data.steps.find((s) => s.key === "in_production")?.pctOfTop.toFixed(0) ?? 0}%`
                : "—"
            }
            hint={
              data
                ? `${data.steps.find((s) => s.key === "in_production")?.count ?? 0} de ${data.totalLeads}`
                : undefined
            }
            icon={FileCheck}
            loading={isLoading}
          />
          <KpiCard
            label="Enviado ao cliente"
            value={data ? `${data.proposalRate.toFixed(0)}%` : "—"}
            hint={
              data
                ? `${data.steps.find((s) => s.key === "sent")?.count ?? 0} propostas enviadas`
                : undefined
            }
            icon={Send}
            loading={isLoading}
          />
          <KpiCard
            label="Taxa de fechamento"
            value={data ? `${data.closeRate.toFixed(1)}%` : "—"}
            hint={
              data
                ? `${data.steps.find((s) => s.key === "closed")?.count ?? 0} contratos fechados`
                : undefined
            }
            icon={Trophy}
            tone="success"
            loading={isLoading}
          />
        </div>

        {/* Funil */}
        <ConversionFunnelChart steps={data?.steps ?? []} loading={isLoading} />

        {/* Resumo lateral */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-2">
              Em andamento
            </p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-foreground">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (data?.inFlight ?? 0)}
            </p>
            <p className="text-[11px] text-muted-foreground/80 font-body mt-1">
              Não fechados nem perdidos
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-2">
              Perdidos
            </p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-foreground">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (data?.lostCount ?? 0)}
            </p>
            <p className="text-[11px] text-muted-foreground/80 font-body mt-1">
              Marcados como perdidos no período
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-2">
              Conversão lead → contrato
            </p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                `${(data?.closeRate ?? 0).toFixed(2)}%`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground/80 font-body mt-1">
              Eficiência ponta-a-ponta
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/comercial">Ver pipeline completo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
