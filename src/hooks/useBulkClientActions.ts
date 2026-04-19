import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Bulk actions sobre a tabela `clients`. Cada operação:
 *  - executa o update em massa;
 *  - invalida queries de clientes;
 *  - retorna a contagem afetada para mensagens consistentes.
 */
export function useBulkAssignOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientIds: string[]; ownerId: string | null }) => {
      if (input.clientIds.length === 0) return 0;
      const { error, count } = await supabase
        .from("clients")
        .update({ commercial_owner_id: input.ownerId }, { count: "exact" })
        .in("id", input.clientIds);
      if (error) throw error;
      return count ?? input.clientIds.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Responsável atualizado em ${n} cliente${n === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => {
      toast.error("Falha ao atualizar responsáveis", { description: e.message });
    },
  });
}

export function useBulkArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientIds: string[] }) => {
      if (input.clientIds.length === 0) return 0;
      const { error, count } = await supabase
        .from("clients")
        .update({ is_active: false }, { count: "exact" })
        .in("id", input.clientIds);
      if (error) throw error;
      return count ?? input.clientIds.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`${n} cliente${n === 1 ? "" : "s"} arquivado${n === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => {
      toast.error("Falha ao arquivar clientes", { description: e.message });
    },
  });
}

/**
 * Adiciona tags em massa preservando as existentes (lê → merge → grava).
 * Usa atualizações individuais para garantir o merge correto por linha.
 */
export function useBulkAddTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientIds: string[]; tags: string[] }) => {
      const tags = input.tags.map((t) => t.trim()).filter((t) => t.length > 0);
      if (input.clientIds.length === 0 || tags.length === 0) return 0;

      const { data: rows, error: readErr } = await supabase
        .from("clients")
        .select("id, tags")
        .in("id", input.clientIds);
      if (readErr) throw readErr;

      let updated = 0;
      for (const row of rows ?? []) {
        const existing = Array.isArray(row.tags) ? (row.tags as string[]) : [];
        const next = Array.from(new Set([...existing, ...tags]));
        if (next.length === existing.length) continue;
        const { error } = await supabase
          .from("clients")
          .update({ tags: next })
          .eq("id", row.id);
        if (error) throw error;
        updated += 1;
      }
      return updated;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Tags adicionadas em ${n} cliente${n === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => {
      toast.error("Falha ao adicionar tags", { description: e.message });
    },
  });
}
