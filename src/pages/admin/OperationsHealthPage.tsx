/**
 * OperationsHealthPage — visão dedicada de saúde da operação.
 *
 * Reúne em uma única página os indicadores executivos que antes ficavam
 * empilhados no header do AdminHome: health-score (gauge semicircular),
 * KPIs de pilotagem, carga da equipe e funil dual.
 *
 * Reaproveita os mesmos hooks/queries do AdminHome para garantir
 * paridade de números — apenas isola a apresentação em uma rota
 * separada acessada sob demanda.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { subDays } from "date-fns";
import { Activity, AlertTriangle, ArrowLeft, GitBranch, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Surface } from "@/components/dashboard/Surface";
import { StatusChip } from "@/components/dashboard/StatusChip";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TeamPerformanceBlock } from "@/components/dashboard/TeamPerformanceBlock";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DualFunnel } from "@/components/dashboard/DualFunnel";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SECTION_DELAY = 0.06;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

/* ───────────────────── HealthScoreGauge ───────────────────── */
function HealthScoreGauge({
  value,
  status,
  loading,
}: {
  value: number | null;
  status: "excellent" | "healthy" | "warning" | "critical" | null;
  loading: boolean;
}) {
  if (loading || value === null || !status) {
    return <Skeleton className="h-[140px] w-full rounded-2xl" />;
  }

  const radius = 60;
  const circumference = Math.PI * radius;
  const filled = (value / 100) * circumference;
  const colorVar =
    status === "excellent" || status === "healthy"
      ? "hsl(var(--success))"
      : status === "warning"
      ? "hsl(var(--warn))"
      : "hsl(var(--danger))";
  const tone =
    status === "excellent" || status === "healthy"
      ? "success"
      : status === "warning"
      ? "warn"
      : "danger";
  const statusLabel =
    status === "excellent"
      ? "Excelente"
      : status === "healthy"
      ? "Saudável"
      : status === "warning"
      ? "Atenção"
      : "Crítico";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
      <svg width={160} height={96} viewBox="0 0 140 86" className="shrink-0" aria-hidden>
        <path
          d={`M 10 70 A 60 60 0 0 1 130 70`}
          fill="none"
          stroke="hsl(var(--hairline))"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={`M 10 70 A 60 60 0 0 1 130 70`}
          fill="none"
          stroke={colorVar}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body">
          Saúde da operação
        </p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-mono font-semibold text-[44px] text-ink-strong tabular-nums leading-none">
            {Math.round(value)}
          </span>
          <span className="font-mono text-[16px] text-ink-soft tabular-nums">/100</span>
        </div>
        <div className="mt-2.5">
          <StatusChip tone={tone as "success" | "warn" | "danger"} size="md">
            {statusLabel}
          </StatusChip>
        </div>
        <p className="text-[12px] text-ink-soft mt-3 max-w-md">
          Composição: SLA no prazo, taxa de conversão, margem bruta e backlog
          ativo no período selecionado.
        </p>
      </div>
    </div>
  );
}

export default function OperationsHealthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budgets, setBudgets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [deliveryTimestamps, setDeliveryTimestamps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    if (!user) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    try {
      const COLS = [
        "id", "client_name", "project_name", "status", "internal_status",
        "created_at", "updated_at", "closed_at", "due_at", "generated_at",
        "estimator_owner_id", "commercial_owner_id", "internal_cost", "view_count",
      ].join(", ");
      const [budgetsRes, profilesRes, eventsRes, totalsRes] = await Promise.all([
        supabase.from("budgets").select(COLS).order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("budget_events")
          .select("budget_id, to_status, created_at")
          .eq("event_type", "status_change")
          .in("to_status", ["sent_to_client", "minuta_solicitada", "contrato_fechado"])
          .order("created_at", { ascending: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("get_budget_totals"),
      ]);
      if (budgetsRes.error) toast.error("Erro ao carregar orçamentos: " + budgetsRes.error.message);

      const totalsMap = new Map<string, number>();
      (totalsRes.data || []).forEach((row: { id: string; total: number | string | null }) => {
        const n = Number(row.total);
        if (Number.isFinite(n)) totalsMap.set(row.id, n);
      });
      const raw = (Array.isArray(budgetsRes.data) ? budgetsRes.data : []) as unknown as Array<Record<string, unknown> & { id: string }>;
      setBudgets(raw.map((b) => ({ ...b, computed_total: totalsMap.get(b.id) ?? null })));

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: { id: string; full_name: string | null }) => {
        profileMap[p.id] = p.full_name || "";
      });
      setProfiles(profileMap);

      const deliveryMap: Record<string, string> = {};
      (eventsRes.data || []).forEach((ev: { budget_id: string; created_at: string }) => {
        if (!deliveryMap[ev.budget_id]) deliveryMap[ev.budget_id] = ev.created_at;
      });
      setDeliveryTimestamps(deliveryMap);
    } catch {
      toast.error("Erro ao carregar dados da saúde da operação.");
    } finally {
      setLoading(false);
    }
  }

  const filteredBudgets = useMemo(
    () => budgets.filter((b) => b.created_at && new Date(b.created_at) >= OPERATIONS_START_DATE),
    [budgets],
  );

  const metrics = useMemo(() => {
    if (loading) return null;
    return computeDashboardMetrics(filteredBudgets, dateRange, profiles, deliveryTimestamps);
  }, [filteredBudgets, dateRange, profiles, deliveryTimestamps, loading]);

  const criticalAlerts = metrics?.alerts.filter((a) => a.severity === "critical").length ?? 0;
  const totalAlerts = metrics?.alerts.length ?? 0;
  const subtitle = loading
    ? "Carregando saúde da operação..."
    : criticalAlerts > 0
    ? `${criticalAlerts} ${criticalAlerts === 1 ? "ponto crítico" : "pontos críticos"} no período.`
    : metrics
    ? `${totalAlerts === 0 ? "Sem alertas no período." : `${totalAlerts} ponto${totalAlerts > 1 ? "s" : ""} para acompanhar.`}`
    : "";

  let step = 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-10">
      {/* HEADER */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <PainelHeader
          title="Saúde da operação"
          subtitle={subtitle}
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-9 px-3"
                onClick={() => navigate("/painel/admin")}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel
              </Button>
              <PeriodFilter value={dateRange} onChange={setDateRange} />
            </>
          }
          meta={
            <Surface variant="raised" padding="md" className="!p-5">
              <HealthScoreGauge
                value={metrics?.healthScore.value ?? null}
                status={metrics?.healthScore.status ?? null}
                loading={loading}
              />
            </Surface>
          }
        />
      </motion.div>

      {/* INBOX DE DECISÕES */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow={criticalAlerts > 0 ? "Ação imediata" : "Monitoramento"}
          tone={criticalAlerts > 0 ? "danger" : "neutral"}
          icon={AlertTriangle}
          title="Inbox de decisões"
          description="Eventos que cruzam capacidade, prazo, financeiro e SLA. Ordenados por severidade."
          count={metrics?.alerts.length ?? null}
        />
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (metrics?.alerts.length ?? 0) === 0 ? (
          <Surface variant="raised" padding="none">
            <EmptyState
              icon={Sparkles}
              title="Tudo sob controle"
              description="Nenhum alerta crítico no período. Aproveite para revisar a estratégia."
            />
          </Surface>
        ) : (
          <AlertsPanel alerts={metrics?.alerts ?? []} />
        )}
      </motion.section>

      {/* KPIs DE PILOTAGEM */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow="Indicadores"
          icon={Activity}
          title="Pilotagem"
          description="Os 4 sinais que importam para decisão executiva."
        />
        <div className={cn("grid gap-4", "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4")}>
          <MetricTile
            label="SLA no prazo"
            kpi={metrics?.slaOnTime ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.slaOnTime}
            format="percent"
            tooltip="% de orçamentos ativos dentro do prazo de produção"
            loading={loading}
            onClick={() => navigate("/admin/operacoes")}
          />
          <MetricTile
            label="Taxa de conversão"
            kpi={metrics?.conversionRate ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.conversionRate}
            format="percent"
            tooltip="Contratos fechados ÷ propostas enviadas no período"
            loading={loading}
            onClick={() => navigate("/painel/comercial")}
          />
          <MetricTile
            label="Margem bruta"
            kpi={metrics?.grossMargin ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.grossMargin}
            format="percent"
            tooltip="(Receita − Custo) ÷ Receita dos contratos fechados"
            loading={loading}
            onClick={() => navigate("/admin/financeiro")}
          />
          <MetricTile
            label="Backlog ativo"
            kpi={metrics?.backlog ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.backlog}
            tooltip="Orçamentos em produção (capacidade ideal: ≤ 8)"
            loading={loading}
            invertTrend
            onClick={() => navigate("/admin/operacoes")}
          />
        </div>
      </motion.section>

      {/* CARGA DA EQUIPE */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow="Equipe"
          icon={Users}
          title="Carga e gargalos"
          description="Distribuição de orçamentos por orçamentista. Identifique sobrecarga e ociosidade."
        />
        <Surface variant="raised" padding="md">
          <TeamPerformanceBlock data={metrics?.teamMetrics ?? []} loading={loading} />
        </Surface>
      </motion.section>

      {/* FUNIL */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow="Conversão"
          icon={GitBranch}
          title="Funil operacional & comercial"
          description="Onde os negócios estão parando. Compare produção e vendas."
        />
        <Surface variant="raised" padding="md">
          <DualFunnel
            operationalFunnel={metrics?.operationalFunnel ?? []}
            commercialFunnel={metrics?.commercialFunnel ?? []}
            loading={loading}
          />
        </Surface>
      </motion.section>
    </div>
  );
}
