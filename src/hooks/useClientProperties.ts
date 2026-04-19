import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientProperty {
  id: string;
  client_id: string;
  label: string | null;
  empreendimento: string | null;
  address: string | null;
  address_complement: string | null;
  bairro: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  metragem: string | null;
  property_type: string | null;
  location_type: string | null;
  floor_plan_url: string | null;
  notes: string | null;
  is_primary: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientPropertyInput = Partial<Omit<ClientProperty, "id" | "created_at" | "updated_at">> & {
  client_id: string;
};

const TABLE = "client_properties" as const;

/** Lista todos os imóveis de um cliente. */
export function useClientProperties(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_properties", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientProperty[]> => {
      if (!clientId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientProperty[];
    },
    staleTime: 1000 * 30,
  });
}

/** Resumo curto e legível de um imóvel. */
export function summarizeProperty(p: Pick<ClientProperty, "label" | "empreendimento" | "bairro" | "city" | "metragem" | "address">): string {
  if (p.label?.trim()) return p.label.trim();
  const parts = [
    p.empreendimento?.trim(),
    p.bairro?.trim(),
    p.metragem?.trim() ? `${p.metragem.trim().replace(/m²?$/i, "")}m²` : null,
  ].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" · ");
  if (p.address?.trim()) return p.address.trim();
  if (p.city?.trim()) return p.city.trim();
  return "Imóvel sem identificação";
}

export function useUpsertClientProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientPropertyInput & { id?: string }) => {
      const { id, ...rest } = input;
      if (id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from(TABLE)
          .update(rest)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data as ClientProperty;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from(TABLE)
        .insert(rest)
        .select("*")
        .single();
      if (error) throw error;
      return data as ClientProperty;
    },
    onSuccess: (prop) => {
      qc.invalidateQueries({ queryKey: ["client_properties", prop.client_id] });
      toast.success("Imóvel salvo!");
    },
    onError: (err) => {
      console.error("[useUpsertClientProperty]", err);
      toast.error(err instanceof Error ? `Erro: ${err.message}` : "Erro ao salvar imóvel.");
    },
  });
}

export function useDeleteClientProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; clientId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(TABLE).delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: ({ clientId }) => {
      qc.invalidateQueries({ queryKey: ["client_properties", clientId] });
      toast.success("Imóvel excluído.");
    },
    onError: (err) => {
      console.error("[useDeleteClientProperty]", err);
      toast.error("Erro ao excluir imóvel (apenas admin pode excluir).");
    },
  });
}

/** Define este imóvel como principal e desmarca os demais do mesmo cliente. */
export function useSetPrimaryProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; clientId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      // 1) desmarca todos
      const { error: e1 } = await sb
        .from(TABLE)
        .update({ is_primary: false })
        .eq("client_id", input.clientId);
      if (e1) throw e1;
      // 2) marca o escolhido
      const { error: e2 } = await sb
        .from(TABLE)
        .update({ is_primary: true })
        .eq("id", input.id);
      if (e2) throw e2;
      return input;
    },
    onSuccess: ({ clientId }) => {
      qc.invalidateQueries({ queryKey: ["client_properties", clientId] });
      toast.success("Imóvel principal atualizado.");
    },
    onError: (err) => {
      console.error("[useSetPrimaryProperty]", err);
      toast.error("Erro ao definir imóvel principal.");
    },
  });
}
