import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { subDays } from "date-fns";
import { BarChart3 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { InsightsHistoryPanel } from "@/components/dashboard/InsightsHistoryPanel";
import { ForecastPanel } from "@/components/admin/ForecastPanel";
import { useUserProfile } from "@/hooks/useUserProfile";
import { OperationsAlertsPanel } from "@/components/dashboard/OperationsAlertsPanel";
import { MetricsTrendChart } from "@/components/dashboard/MetricsTrendChart";
import { TimeInStageChart } from "@/components/dashboard/TimeInStageChart";
import { SnapshotComparisonPanel } from "@/components/dashboard/SnapshotComparisonPanel";
import { IntelligentAlertsPanel } from "@/components/dashboard/IntelligentAlertsPanel";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { computeDashboardMetrics, OPERATIONS_START_DATE, type DateRange } from "@/hooks/useDashboardMetrics";
import { useOperationsInsights } from "@/hooks/useOperationsInsights";
import { useAuth } from "@/hooks/useAuth";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function AnalisesPage() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const location = useLocation();
  const isAdmin = profile?.roles.includes("admin") ?? false;
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

  let step = 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* HEADER */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
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
                Inteligência operacional, alertas, tendências e comparações históricas
              </p>
            </div>
          </div>
          <PeriodFilter value={dateRange} onChange={setDateRange} />
        </div>
      </motion.div>

      {/* FORECAST & PREVISIBILIDADE */}
      <motion.div id="forecast" {...anim(step++ * SECTION_DELAY)}>
        <ForecastPanel ownerFilter={null} isAdmin={isAdmin} />
      </motion.div>

      {/* INTELLIGENT ANALYSIS (current) */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <IntelligentAlertsPanel
          insights={aiInsights.data}
          healthScore={metrics?.healthScore ?? null}
          loading={aiInsights.loading || loading}
          error={aiInsights.error}
          onRefresh={aiInsights.refetch}
        />
      </motion.div>

      {/* INSIGHTS HISTORY */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <InsightsHistoryPanel
          refreshKey={aiInsights.data?.generatedAt ? new Date(aiInsights.data.generatedAt).getTime() : 0}
        />
      </motion.div>

      {/* PROACTIVE ALERTS */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <OperationsAlertsPanel />
      </motion.div>

      {/* METRICS TREND */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <MetricsTrendChart />
      </motion.div>

      {/* TIME IN STAGE + SNAPSHOT COMPARISON */}
      <motion.div {...anim(step++ * SECTION_DELAY)} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TimeInStageChart />
        <SnapshotComparisonPanel />
      </motion.div>
    </div>
  );
}
