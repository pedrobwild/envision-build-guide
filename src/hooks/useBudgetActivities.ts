import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, startOfDay, endOfDay } from "date-fns";

export interface BudgetActivity {
  id: string;
  budget_id: string;
  type: string;
  title: string;
  description: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  outcome: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Enrichment (join client-side)
  budget_project_name?: string;
  budget_client_name?: string;
  budget_sequential_code?: string | null;
}

interface UpcomingFilters {
  /** Janela em dias (default: 7). */
  days?: number;
  /** Se true, inclui atividades já vencidas e ainda não concluídas. */
  includeOverdue?: boolean;
  /** Filtra por owner. */
  ownerId?: string | null;
}

/**
 * Atividades agendadas dos próximos N dias, opcionalmente incluindo as atrasadas.
 * Faz join client-side com budgets para exibir o contexto (cliente / projeto / código).
 */
export function useUpcomingActivities(filters: UpcomingFilters = {}) {
  const days = filters.days ?? 7;
  return useQuery({
    queryKey: ["budget_activities", "upcoming", days, filters.includeOverdue, filters.ownerId],
    queryFn: async (): Promise<BudgetActivity[]> => {
      const now = new Date();
      const upperBound = endOfDay(addDays(now, days));
      const lowerBound = filters.includeOverdue
        ? new Date("2000-01-01")
        : startOfDay(now);

      let query = supabase
        .from("budget_activities")
        .select("*")
        .is("completed_at", null)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", lowerBound.toISOString())
        .lte("scheduled_for", upperBound.toISOString())
        .order("scheduled_for", { ascending: true });

      if (filters.ownerId) {
        query = query.or(`owner_id.eq.${filters.ownerId},created_by.eq.${filters.ownerId}`);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      const activities = (data ?? []) as BudgetActivity[];

      // Enrich with budget context
      const budgetIds = [...new Set(activities.map((a) => a.budget_id))];
      if (budgetIds.length === 0) return activities;

      const { data: budgets } = await supabase
        .from("budgets")
        .select("id, project_name, client_name, sequential_code")
        .in("id", budgetIds);

      const map = new Map<string, { project_name: string; client_name: string; sequential_code: string | null }>();
      for (const b of budgets ?? []) {
        map.set(b.id, {
          project_name: b.project_name,
          client_name: b.client_name,
          sequential_code: b.sequential_code,
        });
      }

      return activities.map((a) => {
        const ctx = map.get(a.budget_id);
        return {
          ...a,
          budget_project_name: ctx?.project_name,
          budget_client_name: ctx?.client_name,
          budget_sequential_code: ctx?.sequential_code,
        };
      });
    },
    staleTime: 1000 * 30,
  });
}

/** Marca atividade como concluída. */
export function useCompleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome?: string }) => {
      const { error } = await supabase
        .from("budget_activities")
        .update({
          completed_at: new Date().toISOString(),
          outcome: outcome ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_activities"] });
      toast.success("Atividade concluída");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao concluir");
    },
  });
}

/** Reagenda atividade. */
export function useRescheduleActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduled_for }: { id: string; scheduled_for: string }) => {
      const { error } = await supabase
        .from("budget_activities")
        .update({ scheduled_for })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_activities"] });
      toast.success("Atividade reagendada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao reagendar");
    },
  });
}
