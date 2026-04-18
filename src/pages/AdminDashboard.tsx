import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatBRL } from "@/lib/formatBRL";
import {
  Plus, FileText, Upload, FileSpreadsheet, LayoutTemplate, Loader2,
} from "lucide-react";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { TemplateSelectorDialog } from "@/components/editor/TemplateSelectorDialog";
import { toast } from "sonner";
import { subDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { KpiCard, KpiCardCompact } from "@/components/dashboard/KpiCard";
import { BacklogByStatusChart } from "@/components/dashboard/OperationalCharts";
import { RevenueChart } from "@/components/dashboard/FinancialCharts";
import { TeamPerformanceBlock } from "@/components/dashboard/TeamPerformanceBlock";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { IntelligentAlertsPanel } from "@/components/dashboard/IntelligentAlertsPanel";
import { InsightsHistoryPanel } from "@/components/dashboard/InsightsHistoryPanel";
import { MetricsTrendChart } from "@/components/dashboard/MetricsTrendChart";
import { OperationsAlertsPanel } from "@/components/dashboard/OperationsAlertsPanel";
import { TimeInStageChart } from "@/components/dashboard/TimeInStageChart";
import { SnapshotComparisonPanel } from "@/components/dashboard/SnapshotComparisonPanel";
import { DualFunnel } from "@/components/dashboard/DualFunnel";
import { BacklogAgingPanel } from "@/components/dashboard/BacklogAgingPanel";
import { BudgetSearchPanel } from "@/components/dashboard/BudgetSearchPanel";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";
import { useOperationsInsights } from "@/hooks/useOperationsInsights";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading, isAdmin, isOrcamentista, isComercial } = useUserProfile();

  useEffect(() => {
    if (!profileLoading && profile && !isAdmin) {
      if (isOrcamentista) {
        navigate("/admin/producao", { replace: true });
      } else if (isComercial) {
        navigate("/admin/comercial", { replace: true });
      }
    }
  }, [profileLoading, profile, isOrcamentista, isComercial, isAdmin, navigate]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budgets, setBudgets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [deliveryTimestamps, setDeliveryTimestamps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateBudgetId, setTemplateBudgetId] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [budgetsRes, profilesRes, eventsRes] = await Promise.all([
        supabase
          .from("budgets")
          .select("*, sections(id, title, section_price, qty, items(id, internal_total, internal_unit_price, qty, bdi_percentage)), adjustments(id, sign, amount)")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
        supabase
          .from("budget_events")
          .select("budget_id, to_status, created_at")
          .eq("event_type", "status_change")
          .in("to_status", ["sent_to_client", "minuta_solicitada", "contrato_fechado"])
          .order("created_at", { ascending: true }),
      ]);
      if (budgetsRes.error) {
        toast.error("Erro ao carregar orçamentos: " + budgetsRes.error.message);
      }
      setBudgets(budgetsRes.data || []);
      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: { id: string; full_name: string | null }) => {
        profileMap[p.id] = p.full_name || "";
      });
      setProfiles(profileMap);

      // Build map of budget_id → earliest delivery timestamp (first transition to a delivered status)
      const deliveryMap: Record<string, string> = {};
      (eventsRes.data || []).forEach((ev: { budget_id: string; created_at: string }) => {
        if (!deliveryMap[ev.budget_id]) {
          deliveryMap[ev.budget_id] = ev.created_at;
        }
      });
      setDeliveryTimestamps(deliveryMap);
    } catch (err) {
      toast.error("Erro ao carregar dados do painel.");
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (!b.created_at) return false;
      return new Date(b.created_at) >= OPERATIONS_START_DATE;
    });
  }, [budgets]);

  const metrics = useMemo(() => {
    if (loading) return null;
    return computeDashboardMetrics(filteredBudgets, dateRange, profiles, deliveryTimestamps);
  }, [filteredBudgets, dateRange, profiles, deliveryTimestamps, loading]);

  // AI-generated operational insights (replaces static AlertsPanel)
  const aiInsights = useOperationsInsights(metrics, dateRange, !loading && !!metrics);

  // Budget creation
  const createBudget = async () => {
    if (!user) return;
    const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data } = await supabase
      .from("budgets")
      .insert({ project_name: "Novo Projeto", client_name: "Cliente", created_by: user.id, public_id: publicId })
      .select()
      .single();
    if (data) {
      try {
        const { seedFromTemplate } = await import("@/lib/seed-from-template");
        await seedFromTemplate(data.id, "a01da86a-9184-4693-bd07-6798c2bf79b2");
      } catch (e) {
        toast.error("Erro ao aplicar template padrão.");
      }
      navigate(`/admin/budget/${data.id}`);
    }
  };

  const createBudgetForTemplate = async () => {
    if (!user) return;
    const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data } = await supabase
      .from("budgets")
      .insert({ project_name: "Novo Projeto", client_name: "Cliente", created_by: user.id, public_id: publicId })
      .select()
      .single();
    if (data) {
      setTemplateBudgetId(data.id);
      setTemplateDialogOpen(true);
    }
  };

  let step = 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ───── HEADER ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
              Painel Executivo
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Centro de comando — visão geral da operação
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PeriodFilter value={dateRange} onChange={setDateRange} />

            <div className="relative">
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setNewMenuOpen(!newMenuOpen)}>
                <Plus className="h-3.5 w-3.5" /> Novo
              </Button>
              {newMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-lg py-1">
                    <button onClick={() => { setNewMenuOpen(false); createBudget(); }} className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-muted-foreground" /> Em branco
                    </button>
                    {(isAdmin || isOrcamentista) && (
                      <button onClick={() => { setNewMenuOpen(false); createBudgetForTemplate(); }} className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5">
                        <LayoutTemplate className="h-4 w-4 text-muted-foreground" /> Usar template
                      </button>
                    )}
                    <button onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("pdf"); }} className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5">
                      <Upload className="h-4 w-4 text-muted-foreground" /> Importar PDF
                    </button>
                    <button onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("excel"); }} className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Importar Planilha
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ───── QUICK SEARCH ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <BudgetSearchPanel
          budgets={budgets}
          profiles={profiles}
          onRefresh={loadData}
        />
      </motion.div>

      {/* ───── INTELLIGENT ANALYSIS ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <IntelligentAlertsPanel
          insights={aiInsights.data}
          healthScore={metrics?.healthScore ?? null}
          loading={aiInsights.loading || loading}
          error={aiInsights.error}
          onRefresh={aiInsights.refetch}
        />
      </motion.div>

      {/* ───── INSIGHTS HISTORY ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <InsightsHistoryPanel refreshKey={aiInsights.data?.generatedAt ? new Date(aiInsights.data.generatedAt).getTime() : 0} />
      </motion.div>

      {/* ───── METRICS TREND CHART ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <MetricsTrendChart />
      </motion.div>

      {/* ───── KPI CARDS — ROW 1 ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60 font-body mb-3">
          Indicadores-chave de eficiência e resultado
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Recebidos"
            kpi={metrics?.received ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.received}
            tooltip="Orçamentos criados no período selecionado"
            loading={loading}
          />
          <KpiCard
            label="Backlog ativo"
            kpi={metrics?.backlog ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.backlog}
            tooltip="Orçamentos em etapas ativas do processo"
            loading={loading}
            onClick={() => navigate("/admin/operacoes")}
          />
          <KpiCard
            label="SLA no prazo"
            kpi={metrics?.slaOnTime ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.slaOnTime}
            format="percent"
            tooltip="Percentual de orçamentos dentro do prazo"
            loading={loading}
          />
          <KpiCard
            label="Atrasados"
            kpi={metrics?.overdue ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.overdue}
            tooltip="Orçamentos com prazo de entrega vencido"
            invertTrend
            loading={loading}
            onClick={() => navigate("/admin/operacoes?filter=overdue")}
          />
        </div>
      </motion.div>

      {/* ───── KPI CARDS — ROW 2 ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Lead time médio"
            kpi={metrics?.avgLeadTime ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.avgLeadTime}
            format="days"
            tooltip="Tempo médio do recebimento até entrega"
            invertTrend
            loading={loading}
          />
          <KpiCard
            label="Taxa de conversão"
            kpi={metrics?.conversionRate ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.conversionRate}
            format="percent"
            tooltip="Contratos fechados / propostas enviadas"
            loading={loading}
            onClick={() => navigate("/admin/comercial")}
          />
          <KpiCard
            label="Valor em carteira"
            kpi={metrics?.portfolioValue ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.portfolioValue}
            format="currency"
            tooltip="Valor total dos orçamentos em andamento"
            loading={loading}
          />
          <KpiCard
            label="Margem bruta"
            kpi={metrics?.grossMargin ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.grossMargin}
            format="percent"
            tooltip="(Receita − Custo) ÷ Receita"
            loading={loading}
            onClick={() => navigate("/admin/financeiro")}
          />
        </div>
      </motion.div>

      {/* ───── DUAL FUNNEL ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Funil operacional e comercial
        </h2>
        <DualFunnel
          operationalFunnel={metrics?.operationalFunnel ?? []}
          commercialFunnel={metrics?.commercialFunnel ?? []}
          loading={loading}
        />
      </motion.div>

      {/* ───── AGING & SLA RISK ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Aging do backlog e risco de SLA
        </h2>
        <BacklogAgingPanel
          agingBuckets={metrics?.agingBuckets ?? []}
          slaRiskItems={metrics?.slaRiskItems ?? []}
          stalledByStage={metrics?.stalledByStage ?? []}
          loading={loading}
        />
      </motion.div>

      {/* ───── BACKLOG BY STATUS + FINANCIAL ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Eficiência operacional e resultado financeiro
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BacklogByStatusChart
            data={metrics?.backlogByStatus ?? []}
            loading={loading}
          />
          <div className="lg:col-span-2">
            <RevenueChart
              data={metrics?.monthlyFinancials ?? []}
              loading={loading}
            />
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <KpiCardCompact
              label="Receita fechada"
              value={metrics ? formatBRL(metrics.revenue) : "—"}
              subtitle={metrics != null && metrics.revenueChange != null ? `${metrics.revenueChange > 0 ? "+" : ""}${metrics.revenueChange}% vs anterior` : undefined}
              loading={loading}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <KpiCardCompact
              label="Ticket médio"
              value={metrics?.avgTicket ? formatBRL(metrics.avgTicket) : "—"}
              subtitle={metrics ? `${metrics.closedCount} contrato${metrics.closedCount !== 1 ? "s" : ""}` : undefined}
              loading={loading}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <KpiCardCompact
              label="Contratos no período"
              value={metrics ? String(metrics.closedCount) : "—"}
              loading={loading}
            />
          </div>
        </div>
      </motion.div>

      {/* ───── PERFORMANCE DA EQUIPE ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Performance da equipe
        </h2>
        <TeamPerformanceBlock
          data={metrics?.teamMetrics ?? []}
          loading={loading}
        />
      </motion.div>

      {/* ───── MODALS ───── */}
      <ImportExcelModal
        open={importOpen}
        onOpenChange={(v) => { setImportOpen(v); if (!v) loadData(); }}
        fileFilter={importType}
      />

      {templateBudgetId && (
        <TemplateSelectorDialog
          open={templateDialogOpen}
          budgetId={templateBudgetId}
          onOpenChange={(v) => {
            setTemplateDialogOpen(v);
            if (!v && templateBudgetId) {
              navigate(`/admin/budget/${templateBudgetId}`);
              setTemplateBudgetId(null);
            }
          }}
          onConfirm={() => {
            if (templateBudgetId) navigate(`/admin/budget/${templateBudgetId}`);
            setTemplateBudgetId(null);
          }}
        />
      )}
    </div>
  );
}
