import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

import { Plus } from "lucide-react";
import { ClientForm } from "@/components/crm/ClientForm";
import { toast } from "sonner";
import { subDays } from "date-fns";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TeamPerformanceBlock } from "@/components/dashboard/TeamPerformanceBlock";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DualFunnel } from "@/components/dashboard/DualFunnel";

import { BudgetSearchPanel } from "@/components/dashboard/BudgetSearchPanel";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";

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

  // Non-admin users são redirecionados para seus painéis específicos.
  // Importante: mantemos o gate de render abaixo para evitar flash de KPIs
  // distorcidos (a query de budgets sofre filtragem RLS para non-admin,
  // então os totais não refletem a operação inteira).
  const shouldRedirectNonAdmin = !profileLoading && !!profile && !isAdmin && (isOrcamentista || isComercial);

  useEffect(() => {
    if (!shouldRedirectNonAdmin) return;
    if (isOrcamentista) {
      navigate("/admin/producao", { replace: true });
    } else if (isComercial) {
      navigate("/admin/comercial", { replace: true });
    }
  }, [shouldRedirectNonAdmin, isOrcamentista, isComercial, navigate]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budgets, setBudgets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [deliveryTimestamps, setDeliveryTimestamps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [clientFormOpen, setClientFormOpen] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    // Não buscar dados do painel executivo para non-admins; eles serão redirecionados.
    if (!user) return;
    if (profileLoading) return;
    if (profile && !isAdmin && (isComercial || isOrcamentista)) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoading, profile, isAdmin, isComercial, isOrcamentista]);

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

  let step = 0;

  // Gate: enquanto redireciona non-admin, mostra apenas spinner para evitar flash de KPIs distorcidos.
  if (shouldRedirectNonAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Skeleton className="h-6 w-32" />
      </div>
    );
  }

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

            <Button size="sm" className="gap-1.5 h-8" onClick={() => setClientFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo cliente
            </Button>
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
      <ClientForm
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        onSaved={(client) => {
          setClientFormOpen(false);
          if (client?.id) navigate(`/admin/crm/${client.id}`);
        }}
      />
    </div>
  );
}
