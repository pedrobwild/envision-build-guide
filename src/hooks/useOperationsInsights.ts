import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DashboardMetrics, DateRange } from "./useDashboardMetrics";

export interface AiInsight {
  id: string;
  severity: "critical" | "warning" | "info" | "opportunity";
  title: string;
  rootCause: string;
  recommendation: string;
  affectedCount: number;
  estimatedImpactBRL?: number;
  actionPath?: string;
}

export interface OperationsInsightsResponse {
  executiveSummary: string;
  healthDiagnosis: "excellent" | "healthy" | "warning" | "critical";
  insights: AiInsight[];
  generatedAt: string;
}

interface State {
  data: OperationsInsightsResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Reverse-engineer the previous-period absolute value from the current value
 * and the percentage change reported by `makeKpi`. Returns null when not
 * comparable.
 */
function deriveFromChange(current: number | null, changePct: number | null): number | null {
  if (current == null || changePct == null) return null;
  if (changePct === -100) return 0;
  // current = prev * (1 + change/100)  =>  prev = current / (1 + change/100)
  const factor = 1 + changePct / 100;
  if (factor === 0) return null;
  return Math.round((current / factor) * 10) / 10;
}

/**
 * Generates a stable cache signature so we don't re-call the AI on every render.
 * Round numerical values to avoid noise from floating-point fluctuations.
 */
function snapshotSignature(metrics: DashboardMetrics, range: DateRange): string {
  return JSON.stringify({
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    received: metrics.received.value,
    backlog: metrics.backlog.value,
    overdue: metrics.overdue.value,
    sla: Math.round((metrics.slaOnTime.value ?? 0)),
    lead: metrics.avgLeadTime.value,
    conv: metrics.conversionRate.value,
    margin: metrics.grossMargin.value,
    health: metrics.healthScore.value,
    closed: metrics.closedCount,
    revChange: metrics.revenueChange,
    receivedChange: metrics.received.change,
    alerts: metrics.alerts.length,
  });
}

function buildSnapshot(metrics: DashboardMetrics, range: DateRange) {
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)));
  const receivedPrev = deriveFromChange(metrics.received.value, metrics.received.change) ?? 0;
  const leadTimePrev = deriveFromChange(metrics.avgLeadTime.value, metrics.avgLeadTime.change);
  const conversionPrev = deriveFromChange(metrics.conversionRate.value, metrics.conversionRate.change);
  const marginPrev = deriveFromChange(metrics.grossMargin.value, metrics.grossMargin.change);

  return {
    period: { from: range.from.toISOString(), to: range.to.toISOString(), days },
    kpis: {
      received: metrics.received.value ?? 0,
      receivedPrev,
      receivedChangePct: metrics.received.change,
      backlog: metrics.backlog.value ?? 0,
      backlogTrend: metrics.backlog.trend,
      overdue: metrics.overdue.value ?? 0,
      slaOnTime: metrics.slaOnTime.value ?? 0,
      avgLeadTime: metrics.avgLeadTime.value,
      avgLeadTimePrev: leadTimePrev,
      conversionRate: metrics.conversionRate.value,
      conversionRatePrev: conversionPrev,
      grossMargin: metrics.grossMargin.value,
      grossMarginPrev: marginPrev,
      portfolioValue: metrics.portfolioValue.value ?? 0,
      closedCount: metrics.closedCount,
      revenue: metrics.revenue,
      revenueChangePct: metrics.revenueChange,
      avgTicket: metrics.avgTicket,
      throughputPerWeek: metrics.throughput.perWeek,
      throughputTrend: metrics.throughput.trend,
      healthScore: metrics.healthScore.value,
      healthFactors: metrics.healthScore.factors,
    },
    funnels: {
      operational: metrics.operationalFunnel.map((s) => ({
        label: s.label, count: s.count, passRate: s.passRate, drop: s.drop,
      })),
      commercial: metrics.commercialFunnel.map((s) => ({
        label: s.label, count: s.count, passRate: s.passRate, drop: s.drop,
      })),
    },
    aging: metrics.agingBuckets.map((a) => ({ label: a.label, count: a.count })),
    stalled: metrics.stalledByStage.map((s) => ({ label: s.label, count: s.count, avgDays: s.avgDays })),
    stageEfficiency: metrics.stageEfficiency.map((s) => ({
      label: s.label, count: s.count, avgDaysInStage: s.avgDaysInStage, efficiency: s.efficiency,
    })),
    monthlyFinancials: metrics.monthlyFinancials.map((m) => ({
      month: m.month, revenue: m.revenue, cost: m.cost, profit: m.profit, margin: Math.round(m.margin * 10) / 10,
    })),
    team: metrics.teamMetrics.map((m) => ({
      name: m.name,
      activeBudgets: m.activeBudgets,
      completedInPeriod: m.completedInPeriod,
      overdueCount: m.overdueCount,
      waitingInfoCount: m.waitingInfoCount,
      avgLeadTimeDays: m.avgLeadTimeDays,
      slaRate: m.slaRate,
      health: m.health,
    })),
    slaForecast: {
      predictedBreaches7d: metrics.slaForecast.predictedBreaches7d,
      riskBudgets: metrics.slaForecast.riskBudgets,
      confidence: metrics.slaForecast.confidence,
    },
    slaRisk: metrics.slaRiskItems.map((r) => ({
      projectName: r.projectName, clientName: r.clientName, hoursLeft: r.hoursLeft, status: r.status,
    })),
    backlogByStatus: metrics.backlogByStatus.map((s) => ({ label: s.label, count: s.count })),
    localAlerts: metrics.alerts.map((a) => ({
      id: a.id, severity: a.severity, title: a.title, count: a.count ?? null,
    })),
    localInsights: metrics.insights.map((i) => ({ type: i.type, message: i.message })),
  };
}

/**
 * Hook that requests AI-generated operational insights from the
 * `operations-insights` edge function. Caches by snapshot signature so it
 * doesn't re-fire when irrelevant state changes.
 */
export function useOperationsInsights(
  metrics: DashboardMetrics | null,
  range: DateRange,
  enabled = true,
): State & { refetch: () => void } {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const lastSignatureRef = useRef<string | null>(null);
  const cacheRef = useRef<Map<string, OperationsInsightsResponse>>(new Map());

  const run = async (force = false) => {
    if (!metrics || !enabled) return;
    const signature = snapshotSignature(metrics, range);
    if (!force && cacheRef.current.has(signature)) {
      setState({ data: cacheRef.current.get(signature)!, loading: false, error: null });
      lastSignatureRef.current = signature;
      return;
    }
    if (!force && lastSignatureRef.current === signature && state.data) return;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke("operations-insights", {
        body: { snapshot: buildSnapshot(metrics, range) },
      });
      if (error) throw new Error(error.message || "Falha ao gerar insights.");
      if (data?.error) throw new Error(data.error);
      cacheRef.current.set(signature, data as OperationsInsightsResponse);
      lastSignatureRef.current = signature;
      setState({ data: data as OperationsInsightsResponse, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar insights.";
      setState({ data: null, loading: false, error: message });
    }
  };

  useEffect(() => {
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, range.from.getTime(), range.to.getTime(), enabled]);

  return { ...state, refetch: () => run(true) };
}
