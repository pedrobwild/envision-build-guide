import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LostReasonCategory =
  | "preco"
  | "escopo"
  | "concorrente"
  | "timing"
  | "sem_retorno"
  | "desistencia"
  | "outro";

export const LOST_REASON_LABELS: Record<LostReasonCategory, string> = {
  preco: "Preço acima do orçado",
  escopo: "Escopo / produto não atendeu",
  concorrente: "Foi para concorrente",
  timing: "Timing / prazo errado",
  sem_retorno: "Cliente sumiu / sem retorno",
  desistencia: "Desistência da reforma",
  outro: "Outro motivo",
};

export interface LostReasonRow {
  id: string;
  budget_id: string;
  reason_category: LostReasonCategory;
  reason_detail: string | null;
  competitor_name: string | null;
  competitor_value: number | null;
  lost_at: string;
  created_by: string | null;
  // joined
  budget_client_name?: string | null;
  budget_project_name?: string | null;
  budget_sequential_code?: string | null;
  budget_manual_total?: number | null;
  budget_commercial_owner_id?: string | null;
}

export interface LostReasonsAnalytics {
  rows: LostReasonRow[];
  total: number;
  totalValueLost: number;
  byCategory: { category: LostReasonCategory; label: string; count: number; valueLost: number }[];
  byCompetitor: { name: string; count: number; totalValue: number; avgValue: number | null }[];
  byOwner: { ownerId: string; count: number; valueLost: number }[];
}

interface UseLostReasonsOptions {
  /** Janela em dias (default: 90). */
  days?: number;
}

export function useLostReasons(options: UseLostReasonsOptions = {}) {
  const days = options.days ?? 90;
  return useQuery({
    queryKey: ["lost_reasons", "analytics", days],
    queryFn: async (): Promise<LostReasonsAnalytics> => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: reasons, error } = await supabase
        .from("budget_lost_reasons")
        .select("id, budget_id, reason_category, reason_detail, competitor_name, competitor_value, lost_at, created_by")
        .gte("lost_at", since.toISOString())
        .order("lost_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const list = (reasons ?? []) as LostReasonRow[];
      const budgetIds = [...new Set(list.map((r) => r.budget_id))];

      const budgetMap = new Map<string, {
        client_name: string;
        project_name: string;
        sequential_code: string | null;
        manual_total: number | null;
        commercial_owner_id: string | null;
      }>();

      if (budgetIds.length > 0) {
        const { data: budgets } = await supabase
          .from("budgets")
          .select("id, client_name, project_name, sequential_code, manual_total, commercial_owner_id")
          .in("id", budgetIds);
        for (const b of budgets ?? []) {
          budgetMap.set(b.id, {
            client_name: b.client_name,
            project_name: b.project_name,
            sequential_code: b.sequential_code,
            manual_total: b.manual_total,
            commercial_owner_id: b.commercial_owner_id,
          });
        }
      }

      const enriched: LostReasonRow[] = list.map((r) => {
        const ctx = budgetMap.get(r.budget_id);
        return {
          ...r,
          budget_client_name: ctx?.client_name ?? null,
          budget_project_name: ctx?.project_name ?? null,
          budget_sequential_code: ctx?.sequential_code ?? null,
          budget_manual_total: ctx?.manual_total ?? null,
          budget_commercial_owner_id: ctx?.commercial_owner_id ?? null,
        };
      });

      // Agregações
      const catMap = new Map<LostReasonCategory, { count: number; valueLost: number }>();
      const compMap = new Map<string, { count: number; totalValue: number; valueCount: number }>();
      const ownerMap = new Map<string, { count: number; valueLost: number }>();
      let totalValueLost = 0;

      for (const r of enriched) {
        const value = r.budget_manual_total ?? 0;
        totalValueLost += value;

        const cat = catMap.get(r.reason_category) ?? { count: 0, valueLost: 0 };
        cat.count += 1;
        cat.valueLost += value;
        catMap.set(r.reason_category, cat);

        if (r.competitor_name) {
          const c = compMap.get(r.competitor_name) ?? { count: 0, totalValue: 0, valueCount: 0 };
          c.count += 1;
          if (r.competitor_value && r.competitor_value > 0) {
            c.totalValue += r.competitor_value;
            c.valueCount += 1;
          }
          compMap.set(r.competitor_name, c);
        }

        if (r.budget_commercial_owner_id) {
          const o = ownerMap.get(r.budget_commercial_owner_id) ?? { count: 0, valueLost: 0 };
          o.count += 1;
          o.valueLost += value;
          ownerMap.set(r.budget_commercial_owner_id, o);
        }
      }

      const byCategory = Array.from(catMap.entries())
        .map(([category, agg]) => ({
          category,
          label: LOST_REASON_LABELS[category] ?? category,
          count: agg.count,
          valueLost: agg.valueLost,
        }))
        .sort((a, b) => b.count - a.count);

      const byCompetitor = Array.from(compMap.entries())
        .map(([name, agg]) => ({
          name,
          count: agg.count,
          totalValue: agg.totalValue,
          avgValue: agg.valueCount > 0 ? agg.totalValue / agg.valueCount : null,
        }))
        .sort((a, b) => b.count - a.count);

      const byOwner = Array.from(ownerMap.entries())
        .map(([ownerId, agg]) => ({ ownerId, count: agg.count, valueLost: agg.valueLost }))
        .sort((a, b) => b.count - a.count);

      return {
        rows: enriched,
        total: enriched.length,
        totalValueLost,
        byCategory,
        byCompetitor,
        byOwner,
      };
    },
    staleTime: 1000 * 60, // 1 min
  });
}
