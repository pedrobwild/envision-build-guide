/**
 * useOrcamentistaQueues — filas de trabalho para a home do orçamentista.
 *
 * Espelha o conceito de useComercialQueues, mas do ponto de vista da
 * produção:
 *   1. Triagem        — solicitações novas (pending) para começar.
 *   2. Em produção    — em andamento, atribuídos a mim.
 *   3. SLA em risco   — due_at se aproximando ou estourado.
 *   4. Aguardando info— bloqueados por retorno do comercial/cliente.
 *   5. Prontos        — finalizados aguardando revisão/entrega ao comercial.
 *
 * Usa apenas colunas explícitas (sem select *), e respeita admin bypass:
 * se ownerId=null o hook retorna a operação inteira.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductionDealRow {
  id: string;
  client_name: string;
  project_name: string;
  internal_status: string;
  estimator_owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  due_at: string | null;
  prazo_dias_uteis: number | null;
}

export interface OrcamentistaQueues {
  triagem: ProductionDealRow[];
  emProducao: ProductionDealRow[];
  slaRisco: ProductionDealRow[];
  slaEstourado: ProductionDealRow[];
  aguardandoInfo: ProductionDealRow[];
  prontos: ProductionDealRow[];
  /** Total ativo na carga do orçamentista. */
  totalAtivos: number;
}

const ACTIVE_STATUSES = [
  "pending",
  "in_progress",
  "ready_for_review",
  "waiting_info",
  "delivered_to_sales",
];

function hoursUntil(d: string | null): number | null {
  if (!d) return null;
  return (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function useOrcamentistaQueues(ownerId?: string | null) {
  return useQuery({
    queryKey: ["orcamentista-queues", ownerId ?? "all"],
    queryFn: async (): Promise<OrcamentistaQueues> => {
      let q = supabase
        .from("budgets")
        .select(
          "id, client_name, project_name, internal_status, estimator_owner_id, created_at, updated_at, due_at, prazo_dias_uteis",
        )
        .in("internal_status", ACTIVE_STATUSES)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200);
      if (ownerId) q = q.eq("estimator_owner_id", ownerId);

      const { data: rows, error } = await q;
      if (error) throw error;

      const deals: ProductionDealRow[] = (rows || []).map((b) => ({
        id: b.id,
        client_name: b.client_name,
        project_name: b.project_name,
        internal_status: b.internal_status,
        estimator_owner_id: b.estimator_owner_id,
        created_at: b.created_at,
        updated_at: b.updated_at,
        due_at: b.due_at,
        prazo_dias_uteis: b.prazo_dias_uteis,
      }));

      const triagem = deals.filter((d) => d.internal_status === "pending");
      const emProducao = deals.filter((d) => d.internal_status === "in_progress");
      const aguardandoInfo = deals.filter((d) => d.internal_status === "waiting_info");
      const prontos = deals.filter(
        (d) => d.internal_status === "ready_for_review" || d.internal_status === "delivered_to_sales",
      );

      const slaRisco: ProductionDealRow[] = [];
      const slaEstourado: ProductionDealRow[] = [];
      deals.forEach((d) => {
        if (!d.due_at) return;
        if (d.internal_status === "delivered_to_sales") return;
        const h = hoursUntil(d.due_at);
        if (h === null) return;
        if (h < 0) slaEstourado.push(d);
        else if (h <= 48) slaRisco.push(d);
      });

      return {
        triagem,
        emProducao,
        slaRisco,
        slaEstourado,
        aguardandoInfo,
        prontos,
        totalAtivos: deals.filter((d) => d.internal_status !== "delivered_to_sales").length,
      };
    },
    staleTime: 60_000,
  });
}

/** Etiqueta amigável para o status de produção. */
export function productionStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Triagem";
    case "in_progress":
      return "Em produção";
    case "waiting_info":
      return "Aguardando info";
    case "ready_for_review":
      return "Em revisão";
    case "delivered_to_sales":
      return "Entregue ao comercial";
    default:
      return status;
  }
}

/** Próxima ação textual para um deal de produção. */
export function nextProductionAction(deal: ProductionDealRow): string {
  const h = hoursUntil(deal.due_at);
  if (deal.internal_status === "pending") return "Iniciar produção";
  if (deal.internal_status === "waiting_info") return "Cobrar informação pendente";
  if (deal.internal_status === "ready_for_review") return "Revisar e entregar";
  if (deal.internal_status === "in_progress") {
    if (h !== null && h < 0) return `SLA estourado há ${Math.abs(Math.round(h))}h`;
    if (h !== null && h <= 48) return `Vence em ${Math.round(h)}h`;
    return "Continuar produção";
  }
  return "Acompanhar";
}

/** Tempo até o vencimento, em formato curto humano. */
export function shortTimeUntil(d: string | null): string {
  if (!d) return "—";
  const ms = new Date(d).getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = abs / 3_600_000;
  if (h < 1) return overdue ? "atrasado" : "<1h";
  if (h < 24) return `${overdue ? "-" : ""}${Math.round(h)}h`;
  const days = h / 24;
  return `${overdue ? "-" : ""}${Math.round(days)}d`;
}
