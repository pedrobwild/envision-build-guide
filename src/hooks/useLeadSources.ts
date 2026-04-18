import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LeadSourceRow {
  id: string;
  source: string;
  external_id: string | null;
  client_id: string | null;
  budget_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  form_id: string | null;
  form_name: string | null;
  processing_status: string;
  processing_error: string | null;
  received_at: string;
  processed_at: string | null;
  raw_payload: Record<string, unknown>;
}

export interface LeadSourceFilters {
  source?: string;
  status?: string;
  search?: string;
}

/** Lista os leads recebidos via integração externa (paginado, mais recentes primeiro). */
export function useLeadSources(filters: LeadSourceFilters = {}) {
  return useQuery({
    queryKey: ["lead_sources", "list", filters],
    queryFn: async (): Promise<LeadSourceRow[]> => {
      let query = supabase
        .from("lead_sources")
        .select(
          "id, source, external_id, client_id, budget_id, campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, form_id, form_name, processing_status, processing_error, received_at, processed_at, raw_payload",
        )
        .order("received_at", { ascending: false })
        .limit(200);

      if (filters.source) query = query.eq("source", filters.source);
      if (filters.status) query = query.eq("processing_status", filters.status);
      if (filters.search) {
        // Sanitiza para evitar quebrar a sintaxe `or` do PostgREST (vírgulas, parênteses, aspas)
        const s = filters.search.trim().replace(/[,()'"\\]/g, " ");
        if (s.length > 0) {
          query = query.or(
            `external_id.ilike.%${s}%,campaign_name.ilike.%${s}%,form_id.ilike.%${s}%`,
          );
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LeadSourceRow[];
    },
    staleTime: 1000 * 30,
  });
}

/** Métricas agregadas (counts por status, top campanhas, top fontes). */
export function useLeadSourcesMetrics() {
  return useQuery({
    queryKey: ["lead_sources", "metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("source, processing_status, campaign_name, received_at")
        .gte("received_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);
      if (error) throw error;
      const rows = data ?? [];
      const byStatus: Record<string, number> = {};
      const bySource: Record<string, number> = {};
      const byCampaign: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.processing_status] = (byStatus[r.processing_status] || 0) + 1;
        bySource[r.source] = (bySource[r.source] || 0) + 1;
        if (r.campaign_name) {
          byCampaign[r.campaign_name] = (byCampaign[r.campaign_name] || 0) + 1;
        }
      }
      return {
        total: rows.length,
        byStatus,
        bySource,
        byCampaign: Object.entries(byCampaign)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10),
      };
    },
    staleTime: 1000 * 60,
  });
}

/** Reprocessa todos os leads falhados dos últimos 7 dias (admin only). */
export function useReprocessFailedLeads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reprocess-failed-leads", {
        method: "POST",
      });
      if (error) throw error;
      return data as {
        success: boolean;
        processed: number;
        results: Array<{ id: string; status: string; error?: string }>;
      };
    },
    onSuccess: (result) => {
      const list = Array.isArray(result?.results) ? result.results : [];
      const ok = list.filter((r) => r.status === "processed").length;
      const failed = list.filter((r) => r.status === "failed").length;
      const total = result?.processed ?? list.length;
      toast.success(
        `Reprocessamento: ${ok} sucesso, ${failed} falha de ${total} tentados`,
      );
      queryClient.invalidateQueries({ queryKey: ["lead_sources"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? `Erro ao reprocessar: ${err.message}` : "Erro ao reprocessar",
      );
    },
  });
}
