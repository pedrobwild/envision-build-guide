import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeLeadScore, type LeadScoreResult } from "@/lib/lead-score";
import { differenceInCalendarDays } from "date-fns";

/**
 * Calcula scores 0-100 + tier para um conjunto de clientes.
 * - Faz 1 query para client_stats (agregados de orçamentos)
 * - Faz 1 query para budget_activities (recência)
 * - Combina tudo client-side via computeLeadScore.
 *
 * Cache: 2 min. Idempotente. A queryKey é estabilizada com useMemo
 * para evitar re-fetches a cada render do componente que consome.
 */
export function useLeadScores(clientIds: string[]) {
  const ids = useMemo(
    () => [...new Set(clientIds.filter(Boolean))].sort(),
    [clientIds],
  );

  return useQuery({
    queryKey: ["lead_scores", ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<Map<string, LeadScoreResult>> => {
      // 1) Estatísticas agregadas
      const { data: stats, error: statsErr } = await supabase
        .from("client_stats")
        .select(
          "client_id, total_budgets, won_budgets, active_budgets, avg_ticket, pipeline_value, total_won_value, last_budget_at, latest_internal_status",
        )
        .in("client_id", ids);
      if (statsErr) throw statsErr;

      const statsMap = new Map<string, typeof stats extends Array<infer T> ? T : never>();
      for (const s of stats ?? []) {
        if (s.client_id) statsMap.set(s.client_id, s as never);
      }

      // 2) Atividades recentes — pega budgets dos clientes para depois buscar atividades
      const { data: budgets } = await supabase
        .from("budgets")
        .select("id, client_id")
        .in("client_id", ids);

      const budgetIds = (budgets ?? []).map((b) => b.id);
      const budgetToClient = new Map<string, string>();
      for (const b of budgets ?? []) {
        if (b.client_id) budgetToClient.set(b.id, b.client_id);
      }

      // Última atividade por cliente
      const lastActivityByClient = new Map<string, Date>();
      if (budgetIds.length > 0) {
        const { data: acts } = await supabase
          .from("budget_activities")
          .select("budget_id, created_at, completed_at")
          .in("budget_id", budgetIds)
          .order("created_at", { ascending: false })
          .limit(2000);

        const now = new Date();
        for (const a of acts ?? []) {
          const cId = budgetToClient.get(a.budget_id);
          if (!cId) continue;
          const candidateRaw = a.completed_at || a.created_at;
          if (!candidateRaw) continue;
          const candidate = new Date(candidateRaw);
          if (candidate > now) continue;
          const existing = lastActivityByClient.get(cId);
          if (!existing || candidate > existing) {
            lastActivityByClient.set(cId, candidate);
          }
        }
      }

      // 3) Compõe o resultado
      const result = new Map<string, LeadScoreResult>();
      const now = new Date();
      for (const id of ids) {
        const s = statsMap.get(id);
        const lastAct = lastActivityByClient.get(id) ?? null;
        const daysSince = lastAct ? differenceInCalendarDays(now, lastAct) : null;
        const score = computeLeadScore({
          total_budgets: (s?.total_budgets as number | null) ?? 0,
          won_budgets: (s?.won_budgets as number | null) ?? 0,
          active_budgets: (s?.active_budgets as number | null) ?? 0,
          avg_ticket: (s?.avg_ticket as number | null) ?? 0,
          pipeline_value: (s?.pipeline_value as number | null) ?? 0,
          total_won_value: (s?.total_won_value as number | null) ?? 0,
          last_budget_at: (s?.last_budget_at as string | null) ?? null,
          days_since_last_activity: daysSince,
          latest_internal_status: (s?.latest_internal_status as string | null) ?? null,
        });
        result.set(id, score);
      }

      return result;
    },
  });
}
