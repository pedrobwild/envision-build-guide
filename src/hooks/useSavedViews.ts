import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type SavedViewEntity = "budgets" | "clients";

export interface SavedView {
  id: string;
  user_id: string;
  entity: SavedViewEntity;
  name: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown>;
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export function useSavedViews(entity: SavedViewEntity) {
  return useQuery({
    queryKey: ["saved-views", entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_saved_views")
        .select("*")
        .eq("entity", entity)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SavedView[];
    },
    staleTime: 30_000,
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entity: SavedViewEntity;
      name: string;
      filters: Record<string, unknown>;
      sort?: Record<string, unknown>;
      is_shared?: boolean;
      is_default?: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Usuário não autenticado");

      // If is_default, unset previous defaults for this user+entity
      if (input.is_default) {
        await supabase
          .from("user_saved_views")
          .update({ is_default: false })
          .eq("user_id", user_id)
          .eq("entity", input.entity)
          .eq("is_default", true);
      }

      const { data, error } = await supabase
        .from("user_saved_views")
        .insert({
          user_id,
          entity: input.entity,
          name: input.name,
          filters: input.filters as unknown as Json,
          sort: (input.sort ?? {}) as unknown as Json,
          is_shared: input.is_shared ?? false,
          is_default: input.is_default ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SavedView;
    },
    onSuccess: (view) => {
      qc.invalidateQueries({ queryKey: ["saved-views", view.entity] });
      toast.success("Visão salva");
    },
    onError: (e: Error) => {
      toast.error("Não foi possível salvar a visão", { description: e.message });
    },
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Partial<Pick<SavedView, "name" | "filters" | "sort" | "is_shared" | "is_default">>;
    }) => {
      // Handle default exclusivity
      if (input.patch.is_default) {
        const { data: existing } = await supabase
          .from("user_saved_views")
          .select("user_id, entity")
          .eq("id", input.id)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("user_saved_views")
            .update({ is_default: false })
            .eq("user_id", existing.user_id)
            .eq("entity", existing.entity)
            .eq("is_default", true)
            .neq("id", input.id);
        }
      }
      const patch = { ...input.patch } as Record<string, unknown>;
      if (input.patch.filters) patch.filters = input.patch.filters as unknown as Json;
      if (input.patch.sort) patch.sort = input.patch.sort as unknown as Json;
      const { data, error } = await supabase
        .from("user_saved_views")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as SavedView;
    },
    onSuccess: (view) => {
      qc.invalidateQueries({ queryKey: ["saved-views", view.entity] });
    },
    onError: (e: Error) => {
      toast.error("Não foi possível atualizar a visão", { description: e.message });
    },
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; entity: SavedViewEntity }) => {
      const { error } = await supabase.from("user_saved_views").delete().eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: ({ entity }) => {
      qc.invalidateQueries({ queryKey: ["saved-views", entity] });
      toast.success("Visão removida");
    },
    onError: (e: Error) => {
      toast.error("Não foi possível remover a visão", { description: e.message });
    },
  });
}
