import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { subDays } from "date-fns";
import { BarChart3, Brain, Hammer, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InsightsHistoryPanel } from "@/components/dashboard/InsightsHistoryPanel";
import { OperationsAlertsPanel } from "@/components/dashboard/OperationsAlertsPanel";
import { MetricsTrendChart } from "@/components/dashboard/MetricsTrendChart";
import { TimeInStageChart } from "@/components/dashboard/TimeInStageChart";
import { SnapshotComparisonPanel } from "@/components/dashboard/SnapshotComparisonPanel";
import { IntelligentAlertsPanel } from "@/components/dashboard/IntelligentAlertsPanel";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { AiAnalysisPanel } from "@/components/ai-analysis/AiAnalysisPanel";
import { AiAnalysisPanelV2 } from "@/components/ai-analysis/AiAnalysisPanelV2";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";
import { useOperationsInsights } from "@/hooks/useOperationsInsights";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

type PipelineTab = "ia" | "orcamentos" | "comercial";

export default function AnalisesPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [budgets, setBudgets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [deliveryTimestamps, setDeliveryTimestamps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PipelineTab>("ia");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Feature flag por query string: ?analysis=v2 ativa o motor novo.
  // Sem dependência de react-router para manter o componente isolado.
  const useV2Analysis = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("analysis") === "v2";
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
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
        if (budgetsRes.error) toast.error("Erro ao carregar dados: " + budgetsRes.error.message);
        setBudgets(budgetsRes.data || []);
        const map: Record<string, string> = {};
        (profilesRes.data || []).forEach((p: { id: string; full_name: string | null }) => {
          map[p.id] = p.full_name || "";
        });
        setProfiles(map);
        const dmap: Record<string, string> = {};
        (eventsRes.data || []).forEach((ev: { budget_id: string; created_at: string }) => {
          if (!dmap[ev.budget_id]) dmap[ev.budget_id] = ev.created_at;
        });
        setDeliveryTimestamps(dmap);
      } catch {
        toast.error("Erro ao carregar análises.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const filteredBudgets = useMemo(
    () => budgets.filter((b) => b.created_at && new Date(b.created_at) >= OPERATIONS_START_DATE),
    [budgets],
  );

  const metrics = useMemo(() => {
    if (loading) return null;
    return computeDashboardMetrics(filteredBudgets, dateRange, profiles, deliveryTimestamps);
  }, [filteredBudgets, dateRange, profiles, deliveryTimestamps, loading]);

  const aiInsights = useOperationsInsights(metrics, dateRange, !loading && !!metrics);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* HEADER */}
      <motion.div {...anim(0)}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
                Análises e Relatórios
              </h1>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                KPIs específicos por pipeline — escolha o contexto para visualizar
              </p>
            </div>
          </div>
          <PeriodFilter value={dateRange} onChange={setDateRange} />
        </div>
      </motion.div>

      {/* PIPELINE SELECTOR */}
      <motion.div {...anim(SECTION_DELAY)}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as PipelineTab)}>
          <TabsList className="h-11 p-1 w-full sm:w-auto">
            <TabsTrigger value="ia" className="gap-2 px-4 sm:px-6 text-sm flex-1 sm:flex-initial">
              <Brain className="h-4 w-4" />
              Inteligência IA
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="gap-2 px-4 sm:px-6 text-sm flex-1 sm:flex-initial">
              <Hammer className="h-4 w-4" />
              Pipeline Orçamentos
            </TabsTrigger>
            <TabsTrigger value="comercial" className="gap-2 px-4 sm:px-6 text-sm flex-1 sm:flex-initial">
              <Briefcase className="h-4 w-4" />
              Pipeline Comercial
            </TabsTrigger>
          </TabsList>

          {/* IA — análise unificada com NL e insights ranqueados.
              ?analysis=v2 ativa o motor genérico determinístico em
              src/lib/data-analysis (com IA só para interpretação). */}
          <TabsContent value="ia" className="space-y-6 mt-6">
            <motion.div {...anim(0)}>
              {useV2Analysis ? (
                <AiAnalysisPanelV2
                  budgets={filteredBudgets}
                  profiles={profiles}
                  range={dateRange}
                  loading={loading}
                />
              ) : (
                <AiAnalysisPanel
                  budgets={filteredBudgets}
                  profiles={profiles}
                  range={dateRange}
                  loading={loading}
                  role={isAdmin ? "admin" : undefined}
                  screen="/admin/analises"
                />
              )}
            </motion.div>
          </TabsContent>

          {/* ORÇAMENTOS — operações, SLA, throughput, tempo em estágio */}
          <TabsContent value="orcamentos" className="space-y-6 mt-6">
            <motion.div {...anim(0)}>
              <IntelligentAlertsPanel
                insights={aiInsights.data}
                healthScore={metrics?.healthScore ?? null}
                loading={aiInsights.loading || loading}
                error={aiInsights.error}
                onRefresh={aiInsights.refetch}
              />
            </motion.div>

            <motion.div {...anim(SECTION_DELAY)}>
              <OperationsAlertsPanel />
            </motion.div>

            <motion.div {...anim(SECTION_DELAY * 2)}>
              <MetricsTrendChart />
            </motion.div>

            <motion.div {...anim(SECTION_DELAY * 3)} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TimeInStageChart />
              <SnapshotComparisonPanel />
            </motion.div>
          </TabsContent>

          {/* COMERCIAL — histórico de insights e tendências de fechamento */}
          <TabsContent value="comercial" className="space-y-6 mt-6">
            <motion.div {...anim(0)}>
              <InsightsHistoryPanel
                refreshKey={aiInsights.data?.generatedAt ? new Date(aiInsights.data.generatedAt).getTime() : 0}
              />
            </motion.div>

            <motion.div {...anim(SECTION_DELAY)} className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm text-muted-foreground font-body">
                Para projeções de receita, metas mensais e attainment, acesse{" "}
                <a href="/admin/forecast" className="text-primary font-medium hover:underline">
                  Forecast & Previsibilidade
                </a>
                .
              </p>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
