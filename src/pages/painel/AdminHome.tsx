/**
 * AdminHome — home executiva (papel ativo "admin").
 *
 * Foco: pilotagem da operação inteira. NÃO é detalhe de pipeline
 * comercial (isso vive em /painel/comercial) — aqui são decisões
 * que cruzam pessoas, capacidade, SLA e financeiro.
 *
 * Layout em 4 zonas (skill god-mode):
 *   1. HEADER INTELIGENTE — saudação + score de saúde + período.
 *   2. INBOX DE DECISÕES — alertas críticos com ação direta.
 *   3. KPIs DE PILOTAGEM — 4 KPIs (não 8) que importam para o CEO.
 *   4. CARGA DA EQUIPE + FUNIL — onde está travando, em quem.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { subDays } from "date-fns";
import { Plus, Activity, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TeamPerformanceBlock } from "@/components/dashboard/TeamPerformanceBlock";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { DualFunnel } from "@/components/dashboard/DualFunnel";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { ClientForm } from "@/components/crm/ClientForm";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";
import { toast } from "sonner";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function AdminHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
    if (!user) return;
    loadData();
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
      toast.error("Erro ao carregar dados do painel.");
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

  // Subtítulo dinâmico — quantidade de alertas críticos.
  const criticalAlerts = metrics?.alerts.filter((a) => a.severity === "critical").length ?? 0;
  const subtitle = loading
    ? "Carregando indicadores..."
    : criticalAlerts === 0
    ? metrics
      ? `Saúde da operação: ${metrics.healthScore.value}/100 (${metrics.healthScore.status === "excellent" ? "excelente" : metrics.healthScore.status === "healthy" ? "saudável" : metrics.healthScore.status === "warning" ? "atenção" : "crítico"}).`
      : ""
    : `${criticalAlerts} ${criticalAlerts === 1 ? "decisão crítica precisa" : "decisões críticas precisam"} da sua atenção.`;

  let step = 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ───── 1. HEADER ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <PainelHeader
          subtitle={subtitle}
          actions={
            <>
              <PeriodFilter value={dateRange} onChange={setDateRange} />
              <Button size="sm" className="gap-1.5 h-8" onClick={() => setClientFormOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Novo cliente
              </Button>
            </>
          }
        />
      </motion.div>

      {/* ───── 2. INBOX DE DECISÕES (alertas) ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <h2 className="text-sm font-semibold font-display text-foreground tracking-tight">
            Inbox de decisões
          </h2>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <AlertsPanel alerts={metrics?.alerts ?? []} />
        )}
      </motion.div>

      {/* ───── 3. KPIs DE PILOTAGEM (4, não 8) ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-semibold font-display text-foreground tracking-tight">
            Indicadores de pilotagem
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="SLA no prazo"
            kpi={metrics?.slaOnTime ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.slaOnTime}
            format="percent"
            tooltip="% de orçamentos ativos dentro do prazo"
            loading={loading}
            onClick={() => navigate("/admin/operacoes")}
          />
          <KpiCard
            label="Taxa de conversão"
            kpi={metrics?.conversionRate ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.conversionRate}
            format="percent"
            tooltip="Contratos fechados ÷ propostas enviadas"
            loading={loading}
            onClick={() => navigate("/painel/comercial")}
          />
          <KpiCard
            label="Margem bruta"
            kpi={metrics?.grossMargin ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.grossMargin}
            format="percent"
            tooltip="(Receita − Custo) ÷ Receita dos contratos do período"
            loading={loading}
            onClick={() => navigate("/admin/financeiro")}
          />
          <KpiCard
            label="Backlog ativo"
            kpi={metrics?.backlog ?? { value: null, change: null, trend: null }}
            meta={metrics?.kpiMeta.backlog}
            tooltip="Orçamentos em produção (capacidade ideal: ≤ 8)"
            loading={loading}
            onClick={() => navigate("/admin/operacoes")}
          />
        </div>
      </motion.div>

      {/* ───── 4. CARGA DA EQUIPE + FUNIL ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-3">
          Carga e gargalos da equipe
        </h2>
        <TeamPerformanceBlock data={metrics?.teamMetrics ?? []} loading={loading} />
      </motion.div>

      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-3">
          Funil operacional e comercial
        </h2>
        <DualFunnel
          operationalFunnel={metrics?.operationalFunnel ?? []}
          commercialFunnel={metrics?.commercialFunnel ?? []}
          loading={loading}
        />
      </motion.div>

      {/* MODAL */}
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
