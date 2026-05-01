/**
 * useComercialQueues — busca os "lotes" que alimentam as filas
 * de trabalho da home Comercial.
 *
 * Filas (priorizadas para o vendedor individual):
 *   1. Prontos para enviar    — entregues pelo orçamentista, ainda não enviados.
 *   2. Sem visualização >48h  — enviados há ≥48h e nunca abertos.
 *   3. Esfriando               — etapas avançadas paradas além do threshold.
 *   4. Leads novos atribuídos — leads recém-roteados ao vendedor.
 *
 * Foco individual: filtra por `commercial_owner_id = currentUser`.
 * Para admin/visão completa, passamos `ownerId = null` e o hook
 * retorna a operação inteira (mesmo comportamento, sem filtro).
 *
 * Esta versão é cliente-side (filtra a partir de uma lista enxuta).
 * Trocamos por views Supabase quando o volume justificar.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealRow {
  id: string;
  client_name: string;
  project_name: string;
  internal_status: string;
  pipeline_stage: string | null;
  commercial_owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  generated_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  total_value: number | null;
  city: string | null;
}

export interface ComercialQueues {
  prontosParaEnviar: DealRow[];
  semVisualizacao48h: DealRow[];
  esfriando: DealRow[];
  novosLeads: DealRow[];
  /** Top 5 negócios em maior risco — combina esfriamento e tempo. */
  topRisco: DealRow[];
  /** Pipeline agrupado por etapa (apenas etapas com algum negócio). */
  pipelinePorEtapa: { stage: string; deals: DealRow[] }[];
  /** Total geral de deals ativos do consultor. */
  totalAtivos: number;
}

const ACTIVE_STATUSES = [
  "delivered_to_sales",
  "sent_to_client",
  "minuta_solicitada",
  "revision_requested",
];

/** Mesmas thresholds da v_pipeline_cooldown_rules (MVP estático). */
const COOLDOWN_DAYS: Record<string, number> = {
  sent_to_client: 5,
  minuta_solicitada: 10,
  waiting_info: 3,
};

const STAGE_ORDER = [
  "delivered_to_sales",
  "sent_to_client",
  "minuta_solicitada",
  "revision_requested",
];

function hoursSince(d: string | null): number {
  if (!d) return 0;
  return (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60);
}

function daysSince(d: string | null): number {
  return hoursSince(d) / 24;
}

export function useComercialQueues(ownerId?: string | null) {
  return useQuery({
    queryKey: ["comercial-queues", ownerId ?? "all"],
    queryFn: async (): Promise<ComercialQueues> => {
      // 1. Lê deals do dono (ou todos se admin).
      let q = supabase
        .from("budgets")
        .select(
          "id, client_name, project_name, internal_status, pipeline_stage, commercial_owner_id, created_at, updated_at, generated_at, last_viewed_at, view_count, city",
        )
        .in("internal_status", ACTIVE_STATUSES)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (ownerId) q = q.eq("commercial_owner_id", ownerId);

      const { data: rows, error } = await q;
      if (error) throw error;

      // 2. Anexa totais via RPC `get_budget_totals` (mesma fonte do AdminDashboard).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: totalsData } = await (supabase as any).rpc("get_budget_totals");
      const totalsMap = new Map<string, number>();
      (totalsData || []).forEach((row: { id: string; total: number | string | null }) => {
        const n = Number(row.total);
        if (Number.isFinite(n)) totalsMap.set(row.id, n);
      });

      const deals: DealRow[] = (rows || []).map((b) => ({
        id: b.id,
        client_name: b.client_name,
        project_name: b.project_name,
        internal_status: b.internal_status,
        pipeline_stage: b.pipeline_stage,
        commercial_owner_id: b.commercial_owner_id,
        created_at: b.created_at,
        updated_at: b.updated_at,
        generated_at: b.generated_at,
        last_viewed_at: b.last_viewed_at,
        view_count: b.view_count ?? 0,
        total_value: totalsMap.get(b.id) ?? null,
        city: b.city,
      }));

      // 3. Particionar em filas.
      const prontosParaEnviar = deals.filter((d) => d.internal_status === "delivered_to_sales");

      const semVisualizacao48h = deals.filter(
        (d) =>
          d.internal_status === "sent_to_client" &&
          d.view_count === 0 &&
          hoursSince(d.generated_at || d.updated_at) >= 48,
      );

      const esfriando = deals.filter((d) => {
        const threshold = COOLDOWN_DAYS[d.internal_status];
        if (!threshold) return false;
        return daysSince(d.updated_at) >= threshold;
      });

      const novosLeads: DealRow[] = []; // placeholder — depende de "lead novo" semantically.
      // Se houver budgets recém-criados (<48h) atribuídos ao consultor, contam como leads novos.
      deals.forEach((d) => {
        if (d.internal_status !== "delivered_to_sales" && d.created_at && hoursSince(d.created_at) <= 48) {
          novosLeads.push(d);
        }
      });

      // 4. Top 5 risco — esfriando ordenados por dias parados, depois por valor.
      const topRisco = [...esfriando]
        .sort((a, b) => {
          const da = daysSince(a.updated_at);
          const db = daysSince(b.updated_at);
          if (db !== da) return db - da;
          return (b.total_value ?? 0) - (a.total_value ?? 0);
        })
        .slice(0, 5);

      // 5. Pipeline agrupado por etapa.
      const grouped = new Map<string, DealRow[]>();
      STAGE_ORDER.forEach((s) => grouped.set(s, []));
      deals.forEach((d) => {
        const arr = grouped.get(d.internal_status);
        if (arr) arr.push(d);
      });
      const pipelinePorEtapa = STAGE_ORDER.map((stage) => ({
        stage,
        deals: grouped.get(stage) ?? [],
      })).filter((g) => g.deals.length > 0);

      return {
        prontosParaEnviar,
        semVisualizacao48h,
        esfriando,
        novosLeads,
        topRisco,
        pipelinePorEtapa,
        totalAtivos: deals.length,
      };
    },
    staleTime: 60_000,
  });
}

/**
 * Calcula a "próxima ação" textual sugerida para um deal,
 * em linguagem direta (god-mode: imperativa, curta).
 */
export function nextActionForDeal(deal: DealRow): string {
  switch (deal.internal_status) {
    case "delivered_to_sales":
      return "Enviar ao cliente";
    case "sent_to_client":
      if (deal.view_count === 0 && hoursSince(deal.generated_at) >= 48) return "Cobrar visualização";
      if (daysSince(deal.updated_at) >= 5) return "Reativar — sem retorno há dias";
      return "Acompanhar resposta";
    case "minuta_solicitada":
      if (daysSince(deal.updated_at) >= 10) return "Cobrar jurídico/CEO";
      return "Acompanhar minuta";
    case "revision_requested":
      return "Pedir revisão ao orçamentista";
    default:
      return "Verificar status";
  }
}
