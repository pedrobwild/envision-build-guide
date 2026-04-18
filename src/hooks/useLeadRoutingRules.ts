import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LeadRoutingRule {
  id: string;
  name: string;
  is_active: boolean;
  priority: number;
  match_source: string | null;
  match_campaign_id: string | null;
  match_campaign_name_ilike: string | null;
  match_form_id: string | null;
  match_city_ilike: string | null;
  assignment_strategy: "fixed" | "round_robin";
  assigned_owner_id: string | null;
  round_robin_pool: string[] | null;
  round_robin_cursor: number;
  created_at: string;
  updated_at: string;
}

export type LeadRoutingRuleInput = Omit<
  LeadRoutingRule,
  "id" | "created_at" | "updated_at" | "round_robin_cursor"
>;

const QK = ["lead_routing_rules"] as const;

export function useLeadRoutingRules() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_routing_rules")
        .select(
          "id, name, is_active, priority, match_source, match_campaign_id, match_campaign_name_ilike, match_form_id, match_city_ilike, assignment_strategy, assigned_owner_id, round_robin_pool, round_robin_cursor, created_at, updated_at",
        )
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeadRoutingRule[];
    },
  });
}

export function useUpsertRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LeadRoutingRuleInput & { id?: string }) => {
      const payload = {
        ...input,
        match_source: input.match_source || null,
        match_campaign_id: input.match_campaign_id || null,
        match_campaign_name_ilike: input.match_campaign_name_ilike || null,
        match_form_id: input.match_form_id || null,
        match_city_ilike: input.match_city_ilike || null,
        assigned_owner_id:
          input.assignment_strategy === "fixed" ? input.assigned_owner_id : null,
        round_robin_pool:
          input.assignment_strategy === "round_robin" ? input.round_robin_pool : null,
      };
      const { data, error } = await supabase
        .from("lead_routing_rules")
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Regra salva");
    },
    onError: (err: Error) => toast.error("Erro ao salvar regra", { description: err.message }),
  });
}

export function useDeleteRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Regra removida");
    },
    onError: (err: Error) => toast.error("Erro ao remover regra", { description: err.message }),
  });
}

export function useToggleRoutingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("lead_routing_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err: Error) => toast.error("Erro ao atualizar regra", { description: err.message }),
  });
}
