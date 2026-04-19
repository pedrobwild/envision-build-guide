import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { sanitizePostgrestPattern } from "@/lib/postgrest-escape";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];
export type ClientStats = Database["public"]["Views"]["client_stats"]["Row"];

export type ClientStatus = "lead" | "cliente" | "mql";

export const CLIENT_STATUSES: Record<
  ClientStatus,
  { label: string; color: string }
> = {
  mql: { label: "MQL", color: "bg-slate-100 text-slate-700" },
  lead: { label: "Lead", color: "bg-blue-100 text-blue-800" },
  cliente: { label: "Cliente", color: "bg-emerald-100 text-emerald-800" },
};

/**
 * Status efetivo exibido no módulo de clientes.
 * - `cliente` se houver contrato fechado (status persistido pelo trigger DB)
 * - `mql` se o orçamento mais recente do cliente está em etapa inicial do funil
 *   (mql ou qualificacao)
 * - `lead` caso contrário
 */
const MQL_STAGE_STATUSES = new Set(["mql", "qualificacao"]);

export function getEffectiveClientStatus(
  client: Pick<Client, "status">,
  stats: Pick<ClientStats, "latest_internal_status"> | null | undefined,
): ClientStatus {
  const persisted = (client.status as ClientStatus) ?? "lead";
  if (persisted === "cliente") return "cliente";
  const latest = stats?.latest_internal_status;
  if (latest && MQL_STAGE_STATUSES.has(latest)) return "mql";
  return persisted;
}

export const CLIENT_SOURCES: Record<string, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  google: "Google",
  arquiteto: "Arquiteto parceiro",
  corretor: "Corretor",
  site: "Site",
  meta_ads: "Meta Ads (Facebook/Instagram)",
  facebook_ads: "Facebook Ads",
  instagram_ads: "Instagram Ads",
  google_ads: "Google Ads",
  hubspot: "HubSpot",
  outro: "Outro",
};

export interface ClientRowWithStats extends Client {
  stats: ClientStats | null;
}

export interface ClientFilters {
  search?: string;
  status?: ClientStatus[];
  ownerId?: string | null;
  tag?: string | null;
  city?: string | null;
}

/** Lista clientes com estatísticas agregadas e filtros server-side. */
export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ["clients", "list", filters],
    queryFn: async (): Promise<ClientRowWithStats[]> => {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (filters.search && filters.search.trim().length > 0) {
        const s = sanitizePostgrestPattern(filters.search);
        if (s.length > 0) {
          query = query.or(
            `name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,document.ilike.%${s}%,sequential_code.ilike.%${s}%`,
          );
        }
      }
      // Filtros de status: 'cliente' e 'lead' batem com o DB; 'mql' é derivado e
      // aplicado client-side abaixo (pois depende do orçamento mais recente).
      const dbStatusFilter = filters.status?.filter((s) => s === "cliente" || s === "lead");
      const wantsMql = filters.status?.includes("mql") ?? false;
      const wantsLead = filters.status?.includes("lead") ?? false;

      if (dbStatusFilter && dbStatusFilter.length > 0 && !wantsMql) {
        query = query.in("status", dbStatusFilter);
      } else if (wantsMql && !wantsLead && !filters.status?.includes("cliente")) {
        // Apenas MQL: precisamos de clientes em status 'lead' no DB para depois filtrar derivado.
        query = query.eq("status", "lead");
      }
      if (filters.ownerId) {
        query = query.eq("commercial_owner_id", filters.ownerId);
      }
      if (filters.tag) {
        query = query.contains("tags", [filters.tag]);
      }
      if (filters.city) {
        query = query.ilike("city", `%${filters.city}%`);
      }

      const { data: clients, error } = await query.limit(500);
      if (error) throw error;
      const list = (clients ?? []) as Client[];
      if (list.length === 0) return [];

      const ids = list.map((c) => c.id);
      const { data: statsData, error: statsErr } = await supabase
        .from("client_stats")
        .select("*")
        .in("client_id", ids);

      if (statsErr) {
        // Não bloqueia a lista se a view falhar — só retorna sem stats.
        console.error("[useClients] client_stats error:", statsErr);
      }

      const statsMap = new Map<string, ClientStats>();
      for (const s of statsData ?? []) {
        if (s.client_id) statsMap.set(s.client_id, s as ClientStats);
      }

      const enriched: ClientRowWithStats[] = list.map((c) => ({
        ...c,
        stats: statsMap.get(c.id) ?? null,
      }));

      // Aplica filtro derivado de MQL/Lead quando solicitado
      if (filters.status && filters.status.length > 0) {
        const wanted = new Set(filters.status);
        return enriched.filter((c) => wanted.has(getEffectiveClientStatus(c, c.stats)));
      }
      return enriched;
    },
    staleTime: 1000 * 30,
  });
}

/** Detalhes de um cliente específico. */
export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", "detail", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });
}

/** KPIs agregados de um cliente. */
export function useClientStats(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", "stats", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("client_stats")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as ClientStats | null;
    },
  });
}

/** Todos os orçamentos de um cliente, ordenados do mais recente para o mais antigo. */
export function useClientBudgets(clientId: string | undefined) {
  return useQuery({
    queryKey: ["clients", "budgets", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("budgets")
        .select(
          "id, sequential_code, project_name, status, internal_status, manual_total, internal_cost, created_at, updated_at, due_at, priority, commercial_owner_id, estimator_owner_id, condominio, bairro, city, metragem, public_id",
        )
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Upsert por email/telefone: se existir um cliente ativo com o mesmo email
 * ou phone, atualiza; senão cria um novo. Retorna sempre o Client resultante.
 */
export async function upsertClientByContact(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  extra?: Partial<ClientInsert>;
  createdBy?: string | null;
}): Promise<Client> {
  const name = input.name.trim();
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;

  // 1) Busca existente por email (case-insensitive) ou por phone
  let existing: Client | null = null;

  if (email) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .ilike("email", email)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    existing = ((data?.[0] as Client | undefined) ?? null);
  }
  if (!existing && phone) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("phone", phone)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1);
    existing = ((data?.[0] as Client | undefined) ?? null);
  }

  if (existing) {
    // Atualiza só se faltar info, para não sobrescrever o que foi editado
    const patch: ClientUpdate = {};
    if (!existing.email && email) patch.email = email;
    if (!existing.phone && phone) patch.phone = phone;
    if (existing.name !== name && name) patch.name = name;
    if (input.extra) Object.assign(patch, input.extra);

    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase
        .from("clients")
        .update(patch)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Client;
    }
    return existing;
  }

  // 2) Cria
  const insertPayload: ClientInsert = {
    name,
    email,
    phone,
    created_by: input.createdBy ?? null,
    status: "lead",
    ...(input.extra ?? {}),
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) throw error;
  return data as Client;
}

export function useUpsertClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientInsert | (ClientUpdate & { id: string })) => {
      if ("id" in input && input.id) {
        const { id, ...rest } = input;
        const { data, error } = await supabase
          .from("clients")
          .update(rest)
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return data as Client;
      }
      const { data, error } = await supabase
        .from("clients")
        .insert(input as ClientInsert)
        .select("*")
        .single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(client.id ? "Cliente salvo!" : "Cliente criado!");
    },
    onError: (err) => {
      console.error("[useUpsertClient]", err);
      toast.error(
        err instanceof Error ? `Erro ao salvar cliente: ${err.message}` : "Erro ao salvar cliente.",
      );
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      // Soft delete: mantém hist. de orçamentos mas tira da carteira.
      const { error } = await supabase
        .from("clients")
        .update({ is_active: false })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente arquivado.");
    },
    onError: (err) => {
      console.error("[useDeleteClient]", err);
      toast.error("Erro ao arquivar cliente.");
    },
  });
}

/** Utilitário: busca rápida para autocompletes (retorna até 10). */
export async function searchClients(query: string): Promise<Client[]> {
  const q = sanitizePostgrestPattern(query);
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("is_active", true)
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(10);
  if (error) {
    if (import.meta.env.DEV) console.error("[searchClients]", error);
    return [];
  }
  return (data ?? []) as Client[];
}
