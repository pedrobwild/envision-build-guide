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
import { BacklogByStatusChart, SimpleFunnel } from "@/components/dashboard/OperationalCharts";
import { RevenueChart } from "@/components/dashboard/FinancialCharts";
import { TeamPerformanceBlock } from "@/components/dashboard/TeamPerformanceBlock";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { computeDashboardMetrics, type DateRange } from "@/hooks/useDashboardMetrics";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading, isAdmin, isOrcamentista } = useUserProfile();

  // Redirect orcamentistas to their dedicated workspace
  useEffect(() => {
    if (!profileLoading && profile && isOrcamentista && !isAdmin) {
      navigate("/admin/producao", { replace: true });
    }
  }, [profileLoading, profile, isOrcamentista, isAdmin, navigate]);

  const [budgets, setBudgets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
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
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    const [budgetsRes, profilesRes] = await Promise.all([
      supabase
        .from("budgets")
        .select("*, sections(id, title, section_price, qty, items(id, internal_total, internal_unit_price, qty, bdi_percentage)), adjustments(id, sign, amount)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);

    setBudgets(budgetsRes.data || []);

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => {
      profileMap[p.id] = p.full_name || "";
    });
    setProfiles(profileMap);
    setLoading(false);
  };

  const getBudgetTotal = (budget: any) => {
    const sectionsTotal = (budget.sections || []).reduce((sum: number, s: any) => sum + calculateSectionSubtotal(s), 0);
    const adjustmentsTotal = (budget.adjustments || []).reduce((sum: number, adj: any) => sum + adj.sign * Number(adj.amount), 0);
    return sectionsTotal + adjustmentsTotal;
  };

  // Compute all metrics
  const metrics = useMemo(() => {
    if (loading || budgets.length === 0) return null;
    return computeDashboardMetrics(budgets, dateRange, profiles);
  }, [budgets, dateRange, profiles, loading]);

  // Funnel data
  const funnelData = useMemo(() => {
    if (!metrics) return { received: 0, published: 0, closed: 0 };
    return {
      received: metrics.received.value ?? 0,
      published: budgets.filter((b) => {
        const d = b.generated_at || b.updated_at;
        return d && new Date(d) >= dateRange.from && new Date(d) <= dateRange.to &&
          ["published", "contrato_fechado", "minuta_solicitada"].includes(b.status);
      }).length,
      closed: metrics.closedCount,
    };
  }, [metrics, budgets, dateRange]);

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
        console.warn("[CreateBudget] Template seed failed:", e);
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

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ───── HEADER ───── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
              Painel Executivo
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Visão geral da operação no período selecionado
            </p>
          </div>

          <div className="flex items-center gap-2">
            <PeriodFilter value={dateRange} onChange={setDateRange} />

            {/* New budget dropdown */}
            <div className="relative">
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setNewMenuOpen(!newMenuOpen)}>
                <Plus className="h-3.5 w-3.5" /> Novo
              </Button>
              {newMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-lg py-1">
                    <button
                      onClick={() => { setNewMenuOpen(false); createBudget(); }}
                      className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" /> Em branco
                    </button>
                    {(isAdmin || isOrcamentista) && (
                      <button
                        onClick={() => { setNewMenuOpen(false); createBudgetForTemplate(); }}
                        className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                      >
                        <LayoutTemplate className="h-4 w-4 text-muted-foreground" /> Usar template
                      </button>
                    )}
                    <button
                      onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("pdf"); }}
                      className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" /> Importar PDF
                    </button>
                    <button
                      onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("excel"); }}
                      className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Importar Planilha
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ───── KPI CARDS — ROW 1 ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/60 font-body mb-3">
          Indicadores-chave de eficiência e resultado
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Recebidos"
            kpi={metrics?.received ?? { value: null, change: null, trend: null }}
            tooltip="Orçamentos criados no período selecionado"
            loading={loading}
          />
          <KpiCard
            label="Backlog ativo"
            kpi={metrics?.backlog ?? { value: null, change: null, trend: null }}
            tooltip="Orçamentos em etapas ativas do processo"
            loading={loading}
          />
          <KpiCard
            label="SLA no prazo"
            kpi={metrics?.slaOnTime ?? { value: null, change: null, trend: null }}
            format="percent"
            tooltip="Percentual de orçamentos dentro do prazo"
            loading={loading}
            alert={metrics ? (metrics.slaOnTime.value ?? 100) < 70 : false}
          />
          <KpiCard
            label="Atrasados"
            kpi={metrics?.overdue ?? { value: null, change: null, trend: null }}
            tooltip="Orçamentos com prazo de entrega vencido"
            invertTrend
            loading={loading}
            alert={metrics ? (metrics.overdue.value ?? 0) > 0 : false}
          />
        </div>
      </motion.div>

      {/* ───── KPI CARDS — ROW 2 ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Lead time médio"
            kpi={metrics?.avgLeadTime ?? { value: null, change: null, trend: null }}
            format="days"
            tooltip="Tempo médio do recebimento até entrega da proposta"
            invertTrend
            loading={loading}
          />
          <KpiCard
            label="Taxa de conversão"
            kpi={metrics?.conversionRate ?? { value: null, change: null, trend: null }}
            format="percent"
            tooltip="Contratos fechados sobre total de propostas enviadas"
            loading={loading}
          />
          <KpiCard
            label="Valor em carteira"
            kpi={metrics?.portfolioValue ?? { value: null, change: null, trend: null }}
            format="currency"
            tooltip="Valor total dos orçamentos em andamento"
            loading={loading}
          />
          <KpiCard
            label="Margem bruta"
            kpi={metrics?.grossMargin ?? { value: null, change: null, trend: null }}
            format="percent"
            tooltip="(Receita − Custo) ÷ Receita no período"
            loading={loading}
            alert={metrics ? (metrics.grossMargin.value ?? 100) < 15 && (metrics.grossMargin.value ?? 100) > 0 : false}
          />
        </div>
      </motion.div>

      {/* ───── EFICIÊNCIA OPERACIONAL ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Eficiência operacional
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BacklogByStatusChart
            data={metrics?.backlogByStatus ?? []}
            loading={loading}
          />
          <SimpleFunnel
            data={funnelData}
            loading={loading}
          />
        </div>
      </motion.div>

      {/* ───── RESULTADO FINANCEIRO ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Resultado financeiro e comercial
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart
              data={metrics?.monthlyFinancials ?? []}
              loading={loading}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
              Resumo do período
            </h3>
            <KpiCardCompact
              label="Receita fechada"
              value={metrics ? formatBRL(metrics.revenue) : "—"}
              subtitle={metrics?.revenueChange !== null ? `${metrics!.revenueChange > 0 ? "+" : ""}${metrics!.revenueChange}% vs anterior` : undefined}
              loading={loading}
            />
            <KpiCardCompact
              label="Ticket médio"
              value={metrics?.avgTicket ? formatBRL(metrics.avgTicket) : "—"}
              subtitle={metrics ? `${metrics.closedCount} contrato${metrics.closedCount !== 1 ? "s" : ""} fechado${metrics.closedCount !== 1 ? "s" : ""}` : undefined}
              loading={loading}
            />
            <KpiCardCompact
              label="Contratos no período"
              value={metrics ? String(metrics.closedCount) : "—"}
              loading={loading}
            />
          </div>
        </div>
      </motion.div>

      {/* ───── PERFORMANCE DA EQUIPE ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
          Performance da equipe
        </h2>
        <TeamPerformanceBlock
          data={metrics?.teamMetrics ?? []}
          loading={loading}
        />
      </motion.div>

      {/* ───── INSIGHTS ───── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <InsightsPanel
          insights={metrics?.insights ?? []}
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
