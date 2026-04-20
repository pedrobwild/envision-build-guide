import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetPipelineMetaRow {
  id: string;
  pipeline_id: string | null;
  pipeline_slug: string | null;
  pipeline_name: string | null;
  stage_entered_at: string | null;
  days_in_stage: number;
}

/**
 * Lê a view `budget_pipeline_view` para todos os budgets passados.
 * Usado para alimentar o badge "X dias parado" e o filtro por pipeline no Kanban.
 *
 * Devolve um Map<budgetId, meta> para acesso O(1) no render.
 */
export function useBudgetPipelineMeta(budgetIds: string[]) {
  const ids = [...new Set(budgetIds)].sort();
  return useQuery({
    queryKey: ["budget_pipeline_meta", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, BudgetPipelineMetaRow>> => {
      const { data, error } = await supabase
        .from("budget_pipeline_view")
        .select("id, pipeline_id, pipeline_slug, pipeline_name, stage_entered_at, days_in_stage")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, BudgetPipelineMetaRow>();
      for (const row of (data ?? []) as BudgetPipelineMetaRow[]) {
        map.set(row.id, row);
      }
      return map;
    },
    staleTime: 1000 * 60, // 1 min — dias só mudam diariamente
  });
}
