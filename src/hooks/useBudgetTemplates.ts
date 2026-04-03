import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export function useBudgetTemplates() {
  return useQuery({
    queryKey: ["budget-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_templates" as any)
        .select("id, name, description, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as BudgetTemplate[];
    },
  });
}
