import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";

/**
 * Funil de conversão Pipeline Comercial → Orçamento → Cliente.
 *
 * Cada etapa é uma "porteira": contamos quantos orçamentos JÁ PASSARAM
 * por aquele estágio em algum momento (via budget_events) — não apenas
 * quem está parado lá agora. Isso evita que orçamentos que avançaram
 * desapareçam do topo do funil.
 *
 * Janela padrão: orçamentos criados a partir de 2026-04-15 (início das
 * operações — segue o padrão de mem://logic/dashboard/operations-start-date).
 */

export type ConversionRange = "30d" | "90d" | "all";

export interface FunnelStep {
  key: string;
  label: string;
  description: string;
  count: number;
  /** % em relação ao topo do funil (Lead). */
  pctOfTop: number;
  /** % em relação à etapa anterior (taxa de conversão step-a-step). */
  pctOfPrev: number;
}

export interface ConversionMetrics {
  steps: FunnelStep[];
  totalLeads: number;
  proposalRate: number;   // % leads que viraram proposta enviada
  closeRate: number;      // % leads que fecharam contrato
  lostCount: number;
  inFlight: number;       // ainda ativos (não fechados nem perdidos)
  daysInWindow: number | null;
}

const OPERATIONS_START = "2026-04-15T00:00:00.000Z";

/**
 * Status que indicam "já enviado ao cliente" (proposta visível para o cliente).
 * Mantém compatibilidade com pipeline_bidirectional_sync.
 */
const SENT_TO_CLIENT_STATUSES = new Set([
  "sent_to_client",
  "published",
  "minuta_solicitada",
  "contrato_fechado",
]);

/**
 * Status que indicam "orçamento foi entregue ao comercial pela produção"
 * (pronto para o vendedor enviar ao cliente).
 */
const DELIVERED_TO_SALES_STATUSES = new Set([
  "ready_for_review",
  "em_revisao",
  "delivered_to_sales",
  "sent_to_client",
  "published",
  "minuta_solicitada",
  "contrato_fechado",
]);

/**
 * Status que indicam "produção começou no orçamento" (saiu de lead/triagem).
 */
const IN_PRODUCTION_STATUSES = new Set([
  "in_progress",
  "waiting_info",
  "aguardando_info",
  "revision_requested",
  ...DELIVERED_TO_SALES_STATUSES,
]);

const TERMINAL_STATUSES = new Set(["contrato_fechado", "lost", "perdido", "archived"]);

function rangeToDate(range: ConversionRange): string | null {
  if (range === "all") return OPERATIONS_START;
  const days = range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  const iso = d.toISOString();
  // Nunca antes do início das operações
  return iso < OPERATIONS_START ? OPERATIONS_START : iso;
}

interface BudgetRow {
  id: string;
  internal_status: string;
  created_at: string;
  commercial_owner_id: string | null;
}

interface EventRow {
  budget_id: string;
  to_status: string | null;
  created_at: string;
}

export function useCommercialConversion(range: ConversionRange = "30d") {
  const { profile, isAdmin } = useUserProfile();
  const userId = profile?.id ?? null;
  const fromIso = rangeToDate(range);

  return useQuery<ConversionMetrics>({
    queryKey: ["commercial-conversion", range, isAdmin ? "admin" : userId],
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 min
    queryFn: async () => {
      // 1) Carrega orçamentos da janela (escopo por dono se não for admin)
      let q = supabase
        .from("budgets")
        .select("id, internal_status, created_at, commercial_owner_id")
        .gte("created_at", fromIso ?? OPERATIONS_START)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (!isAdmin && userId) {
        q = q.eq("commercial_owner_id", userId);
      }

      const { data: budgets, error: bErr } = await q;
      if (bErr) throw bErr;

      const rows = (budgets ?? []) as BudgetRow[];
      const ids = rows.map((r) => r.id);

      // 2) Carrega o histórico de status para calcular "passou por" cada etapa
      let events: EventRow[] = [];
      if (ids.length > 0) {
        const { data: ev, error: eErr } = await supabase
          .from("budget_events")
          .select("budget_id, to_status, created_at")
          .eq("event_type", "status_change")
          .in("budget_id", ids)
          .limit(10000);
        if (eErr) throw eErr;
        events = (ev ?? []) as EventRow[];
      }

      // Sets por etapa "já passou por"
      const everInProduction = new Set<string>();
      const everDelivered = new Set<string>();
      const everSent = new Set<string>();
      const everClosed = new Set<string>();
      const everLost = new Set<string>();

      // Estado atual também conta (para o caso de eventos faltantes)
      for (const r of rows) {
        if (IN_PRODUCTION_STATUSES.has(r.internal_status)) everInProduction.add(r.id);
        if (DELIVERED_TO_SALES_STATUSES.has(r.internal_status)) everDelivered.add(r.id);
        if (SENT_TO_CLIENT_STATUSES.has(r.internal_status)) everSent.add(r.id);
        if (r.internal_status === "contrato_fechado") everClosed.add(r.id);
        if (r.internal_status === "lost" || r.internal_status === "perdido") everLost.add(r.id);
      }
      for (const e of events) {
        const s = e.to_status ?? "";
        if (IN_PRODUCTION_STATUSES.has(s)) everInProduction.add(e.budget_id);
        if (DELIVERED_TO_SALES_STATUSES.has(s)) everDelivered.add(e.budget_id);
        if (SENT_TO_CLIENT_STATUSES.has(s)) everSent.add(e.budget_id);
        if (s === "contrato_fechado") everClosed.add(e.budget_id);
        if (s === "lost" || s === "perdido") everLost.add(e.budget_id);
      }

      const totalLeads = rows.length;
      const inProduction = everInProduction.size;
      const delivered = everDelivered.size;
      const sent = everSent.size;
      const closed = everClosed.size;

      const buildStep = (
        key: string,
        label: string,
        description: string,
        count: number,
        prevCount: number,
      ): FunnelStep => ({
        key,
        label,
        description,
        count,
        pctOfTop: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
        pctOfPrev: prevCount > 0 ? (count / prevCount) * 100 : 0,
      });

      const steps: FunnelStep[] = [
        buildStep("lead", "Leads no pipeline", "Orçamentos criados a partir de leads comerciais", totalLeads, totalLeads),
        buildStep("in_production", "Virou orçamento", "Saiu de triagem e a produção começou", inProduction, totalLeads),
        buildStep("delivered", "Entregue ao comercial", "Produção concluída, pronto para envio", delivered, inProduction),
        buildStep("sent", "Enviado ao cliente", "Cliente recebeu a proposta", sent, delivered),
        buildStep("closed", "Contrato fechado", "Negócio ganho", closed, sent),
      ];

      const inFlight = rows.filter((r) => !TERMINAL_STATUSES.has(r.internal_status)).length;

      const daysInWindow = (() => {
        if (!fromIso) return null;
        const ms = Date.now() - new Date(fromIso).getTime();
        return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
      })();

      return {
        steps,
        totalLeads,
        proposalRate: totalLeads > 0 ? (sent / totalLeads) * 100 : 0,
        closeRate: totalLeads > 0 ? (closed / totalLeads) * 100 : 0,
        lostCount: everLost.size,
        inFlight,
        daysInWindow,
      };
    },
  });
}
