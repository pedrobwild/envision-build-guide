import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealPipeline {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  order_index: number;
  is_active: boolean;
  is_default: boolean;
}

/**
 * Pipelines comerciais (Inbound / Indicação / Re-engajamento / etc.).
 * Usado para filtrar o Kanban e atribuir negócios manualmente.
 */
export function useDealPipelines() {
  return useQuery({
    queryKey: ["deal_pipelines"],
    queryFn: async (): Promise<DealPipeline[]> => {
      const { data, error } = await supabase
        // @ts-expect-error - tabela criada via migration; types regenerados em seguida
        .from("deal_pipelines")
        .select("id, slug, name, description, color, order_index, is_active, is_default")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DealPipeline[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** Atualiza o pipeline de um budget. */
export async function setBudgetPipeline(budgetId: string, pipelineId: string | null): Promise<void> {
  const { error } = await supabase
    .from("budgets")
    // @ts-expect-error - coluna criada via migration; types regenerados em seguida
    .update({ pipeline_id: pipelineId, updated_at: new Date().toISOString() })
    .eq("id", budgetId);
  if (error) throw error;
}
