import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";

export interface BudgetActivityMeta {
  budget_id: string;
  /** Data da última atividade registrada (criada OU concluída), null se nunca houve. */
  last_activity_at: string | null;
  /** Dias desde a última atividade. null se nunca houve. */
  days_since_last_activity: number | null;
  /** Tem atividade agendada futura ainda não concluída. */
  has_scheduled: boolean;
}

/**
 * Para um conjunto de budgets, devolve metadados de atividades:
 * última atividade registrada e se há algo agendado.
 *
 * Usado pelo Kanban para calcular temperatura e sugerir próxima ação.
 */
export function useBudgetActivityMeta(budgetIds: string[]) {
  const ids = [...new Set(budgetIds)].sort();
  return useQuery({
    queryKey: ["budget_activity_meta", ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60, // 1 min
    queryFn: async (): Promise<Map<string, BudgetActivityMeta>> => {
      const { data, error } = await supabase
        .from("budget_activities")
        .select("budget_id, created_at, completed_at, scheduled_for")
        .in("budget_id", ids)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const now = new Date();
      const map = new Map<string, BudgetActivityMeta>();
      for (const id of ids) {
        map.set(id, {
          budget_id: id,
          last_activity_at: null,
          days_since_last_activity: null,
          has_scheduled: false,
        });
      }

      for (const row of data ?? []) {
        const meta = map.get(row.budget_id);
        if (!meta) continue;

        // Última atividade = mais recente entre completed_at e created_at
        const candidate = row.completed_at || row.created_at;
        if (candidate) {
          if (!meta.last_activity_at || new Date(candidate) > new Date(meta.last_activity_at)) {
            meta.last_activity_at = candidate;
            meta.days_since_last_activity = differenceInCalendarDays(now, new Date(candidate));
          }
        }

        // Tem agendamento futuro pendente?
        if (
          !meta.has_scheduled &&
          row.scheduled_for &&
          !row.completed_at &&
          new Date(row.scheduled_for) >= now
        ) {
          meta.has_scheduled = true;
        }
      }

      return map;
    },
  });
}
