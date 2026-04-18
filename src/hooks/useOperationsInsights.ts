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
  });
}

function buildSnapshot(metrics: DashboardMetrics, range: DateRange) {
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)));
  return {
    period: { from: range.from.toISOString(), to: range.to.toISOString(), days },
    kpis: {
      received: metrics.received.value ?? 0,
      receivedPrev: 0,
      backlog: metrics.backlog.value ?? 0,
      overdue: metrics.overdue.value ?? 0,
      slaOnTime: metrics.slaOnTime.value ?? 0,
      avgLeadTime: metrics.avgLeadTime.value,
      conversionRate: metrics.conversionRate.value,
      grossMargin: metrics.grossMargin.value,
      portfolioValue: metrics.portfolioValue.value ?? 0,
      closedCount: metrics.closedCount,
      revenue: metrics.revenue,
      throughputPerWeek: metrics.throughput.perWeek,
      healthScore: metrics.healthScore.value,
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
    team: metrics.teamMetrics.map((m) => ({
      name: m.name,
      activeBudgets: m.activeBudgets,
      overdueCount: m.overdueCount,
      slaRate: m.slaRate,
      health: m.health,
    })),
    slaRisk: metrics.slaRiskItems.map((r) => ({
      projectName: r.projectName, clientName: r.clientName, hoursLeft: r.hoursLeft,
    })),
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
