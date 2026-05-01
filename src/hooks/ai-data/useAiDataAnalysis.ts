/**
 * Hook que orquestra a análise feita pela camada AI Data.
 *
 * Recebe os mesmos `budgets` que o resto do dashboard já carrega para
 * evitar fetch redundante. Opcionalmente busca eventos, motivos de perda
 * e snapshots diários (se o usuário pediu análises preditivas).
 *
 * Como o cálculo é puro (frontend), reagimos imediatamente a mudanças
 * de filtros e à pergunta digitada — sem chamar nenhuma edge function.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetWithSections } from "@/types/budget-common";
import {
  analyze,
  planAnalysis,
  runInsightEngine,
  type AnalysisContext,
  type AnalysisResult,
  type Insight,
  type InsightType,
} from "@/lib/ai-data";

interface Params {
  budgets: BudgetWithSections[];
  profiles?: Record<string, string>;
  range: { from: Date; to: Date };
  /** se true, busca snapshots diários e motivos de perda. */
  includeHistorical?: boolean;
  question?: string;
  context?: AnalysisContext;
}

interface AiDataAnalysisResult {
  result: AnalysisResult;
  insights: Insight[];
  loading: boolean;
  refresh: () => void;
  plannedTypes: InsightType[];
  rationale: string;
}

export function useAiDataAnalysis(params: Params): AiDataAnalysisResult {
  const { budgets, profiles, range, includeHistorical = true, question = "", context = {} } = params;
  const [tick, setTick] = useState(0);

  const snapshotsQ = useQuery({
    queryKey: ["ai-data", "snapshots", includeHistorical],
    enabled: includeHistorical,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_metrics_snapshot")
        .select("generated_at, received_count, closed_count, revenue_brl, conversion_rate_pct, gross_margin_pct, health_score")
        .order("generated_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });

  const lostReasonsQ = useQuery({
    queryKey: ["ai-data", "lost-reasons", range.from.toISOString(), range.to.toISOString(), includeHistorical],
    enabled: includeHistorical,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_lost_reasons")
        .select("budget_id, reason_category, competitor_name, competitor_value, lost_at")
        .gte("lost_at", range.from.toISOString())
        .lte("lost_at", range.to.toISOString())
        .order("lost_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const plan = useMemo(() => planAnalysis(question, { ...context, range }), [question, context, range]);

  const result = useMemo<AnalysisResult>(() => {
    void tick;
    return analyze(
      {
        budgets,
        profiles,
        range,
        snapshots: snapshotsQ.data ?? undefined,
        lostReasons: lostReasonsQ.data ?? undefined,
      },
      { ...context, range, question },
      question ? plan.insightTypes : undefined,
    );
  }, [budgets, profiles, range, snapshotsQ.data, lostReasonsQ.data, context, question, plan.insightTypes, tick]);

  const insights = useMemo<Insight[]>(() => {
    if (!question) {
      return result.insights;
    }
    return runInsightEngine(
      {
        budgets,
        profiles,
        range,
        snapshots: snapshotsQ.data ?? undefined,
        lostReasons: lostReasonsQ.data ?? undefined,
      },
      plan.insightTypes,
    );
  }, [budgets, profiles, range, snapshotsQ.data, lostReasonsQ.data, question, plan.insightTypes, result.insights]);

  // Re-run quando snapshots terminam de carregar
  useEffect(() => {
    if (!snapshotsQ.isLoading && !lostReasonsQ.isLoading) setTick((t) => t + 1);
  }, [snapshotsQ.isLoading, lostReasonsQ.isLoading]);

  return {
    result,
    insights,
    loading: snapshotsQ.isLoading || lostReasonsQ.isLoading,
    refresh: () => setTick((t) => t + 1),
    plannedTypes: plan.insightTypes,
    rationale: plan.rationale,
  };
}
