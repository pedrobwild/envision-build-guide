import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Conversation = Database["public"]["Tables"]["budget_conversations"]["Row"];
export type ConversationMessage = Database["public"]["Tables"]["budget_conversation_messages"]["Row"];
export type DigisacConfig = Database["public"]["Tables"]["digisac_config"]["Row"];

export interface ConversationListItem extends Conversation {
  budget_label?: string | null;
}

/** Lista conversas ordenadas por última mensagem. */
export function useConversations(params: { search?: string; provider?: string } = {}) {
  return useQuery({
    queryKey: ["conversations", params],
    queryFn: async (): Promise<ConversationListItem[]> => {
      let query = supabase
        .from("budget_conversations")
        .select(
          "id, provider, external_id, channel, contact_name, contact_identifier, avatar_url, status, assigned_user_name, last_message_at, last_message_preview, unread_count, updated_at, budget_id, provider_data",
        )
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);

      if (params.provider) query = query.eq("provider", params.provider);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let list = (data ?? []) as ConversationListItem[];

      if (params.search?.trim()) {
        const q = params.search.trim().toLowerCase();
        list = list.filter((c) => {
          const hay = `${c.contact_name ?? ""} ${c.contact_identifier ?? ""} ${c.last_message_preview ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
      }

      return list;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Busca mensagens de uma conversa, ordenadas cronologicamente (antiga → nova). */
export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation_messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ConversationMessage[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("budget_conversation_messages")
        .select(
          "id, conversation_id, external_id, direction, author_name, body, message_type, status, sent_at, created_at, attachments, reply_to_external_id, provider_data",
        )
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true, nullsFirst: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as ConversationMessage[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useSendDigisacMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; text: string; replyTo?: string }) => {
      const res = await supabase.functions.invoke("digisac-send", {
        body: {
          conversation_id: input.conversationId,
          text: input.text,
          reply_to_external_id: input.replyTo,
        },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["conversation_messages", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSyncDigisac() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { since?: string; limit?: number } = {}) => {
      const res = await supabase.functions.invoke("digisac-sync", { body });
      if (res.error) throw new Error(res.error.message);
      return res.data as { success: boolean; tickets: number; messages: number; errors: unknown[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["digisac_config"] });
    },
  });
}

export function useDigisacConfig() {
  return useQuery({
    queryKey: ["digisac_config"],
    queryFn: async (): Promise<DigisacConfig | null> => {
      const { data, error } = await supabase
        .from("digisac_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as DigisacConfig | null;
    },
    staleTime: 60_000,
  });
}

export function useSaveDigisacConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DigisacConfig> & { id?: string }) => {
      if (input.id) {
        const { error } = await supabase
          .from("digisac_config")
          .update(input)
          .eq("id", input.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("digisac_config").insert(input);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["digisac_config"] });
    },
  });
}

/** Linka uma conversa a um orçamento. */
export function useLinkConversationToBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; budgetId: string | null }) => {
      const { error } = await supabase
        .from("budget_conversations")
        .update({ budget_id: input.budgetId })
        .eq("id", input.conversationId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
