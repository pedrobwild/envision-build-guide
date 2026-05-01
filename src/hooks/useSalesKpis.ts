/**
 * Hooks de KPIs de operação de vendas (macro → micro).
 *
 * Consome as views/funções criadas na migration
 * 20260501041500_sales_kpis_godmode.sql:
 *   - v_sales_kpis_overview          (resumo macro)
 *   - v_sales_cycle_by_owner         (por vendedora)
 *   - v_sales_time_in_stage          (tempo médio em cada etapa)
 *   - v_sales_cohort_monthly         (coortes mensais)
 *   - v_sales_lost_reasons_ranked    (motivos de perda)
 *   - sales_conversion_by_segment()  (segmentação dinâmica)
 *   - sales_kpis_dashboard()         (RPC consolidada com filtros)
 *
 * Cada hook expõe o mínimo necessário para o dashboard. As views
 * já são SECURITY INVOKER, então RLS de budgets é respeitada.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// As views são novas — escapamos do tipo gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type SalesRange = "30d" | "90d" | "ytd" | "all" | "custom";

export interface SalesPeriod {
  range: SalesRange;
  /** ISO date — apenas para custom */
  startDate?: string;
  /** ISO date — apenas para custom */
  endDate?: string;
}

const OPERATIONS_START = "2026-04-15T00:00:00.000Z";

export function rangeToBounds(period: SalesPeriod): {
  start: string | null;
  end: string | null;
} {
  const now = new Date();
  if (period.range === "custom") {
    return {
      start: period.startDate ?? OPERATIONS_START,
      end: period.endDate ?? now.toISOString(),
    };
  }
  if (period.range === "all") return { start: OPERATIONS_START, end: null };
  if (period.range === "ytd") {
    const jan = new Date(now.getFullYear(), 0, 1).toISOString();
    return { start: jan < OPERATIONS_START ? OPERATIONS_START : jan, end: null };
  }
  const days = period.range === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  const iso = d.toISOString();
  return { start: iso < OPERATIONS_START ? OPERATIONS_START : iso, end: null };
}

// ============================================================
// 1. Overview macro (RPC consolidada)
// ============================================================
export interface SalesOverview {
  total_leads: number;
  proposals_sent: number;
  deals_won: number;
  deals_lost: number;
  deals_open: number;
  win_rate_pct: number;
  proposal_rate_pct: number;
  avg_cycle_days: number | null;
  p50_cycle_days: number | null;
  p90_cycle_days: number | null;
  avg_deal_size_won: number | null;
  revenue_won: number;
  revenue_lost: number;
  pipeline_open_value: number;
}

export function useSalesOverview(period: SalesPeriod, ownerId?: string | null) {
  // Para ranges relativos (30d/90d/ytd e custom sem endDate) `rangeToBounds`
  // chama `new Date()`, produzindo uma string ISO com ms diferente a cada
  // render. Sem memoização isso mudaria a queryKey continuamente e dispararia
  // refetch infinito do RPC.
  // Deps são os campos primitivos do `period` (não o objeto inteiro): callers
  // tipicamente passam o período como objeto inline, então usar `[period]`
  // quebraria a memoização.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { start, end } = useMemo(() => rangeToBounds(period), [
    period.range,
    period.startDate,
    period.endDate,
  ]);
  return useQuery({
    queryKey: ["sales-kpis", "overview", start, end, ownerId ?? null],
    queryFn: async (): Promise<SalesOverview> => {
      const { data, error } = await sb.rpc("sales_kpis_dashboard", {
        _start_date: start,
        _end_date: end,
        _owner_id: ownerId ?? null,
      });
      if (error) throw error;
      return (data ?? {}) as SalesOverview;
    },
    staleTime: 60_000,
  });
}

// ============================================================
// 2. Performance por vendedora
// ============================================================
export interface OwnerPerformanceRow {
  owner_id: string | null;
  owner_email: string;
  owner_name: string;
  total_leads: number;
  proposals_sent: number;
  deals_won: number;
  deals_lost: number;
  deals_open: number;
  win_rate_pct: number;
  avg_cycle_days: number | null;
  p50_cycle_days: number | null;
  p90_cycle_days: number | null;
  avg_deal_size_won: number | null;
  revenue_won: number;
  pipeline_open_value: number;
}

export function useSalesByOwner() {
  return useQuery({
    queryKey: ["sales-kpis", "by-owner"],
    queryFn: async (): Promise<OwnerPerformanceRow[]> => {
      const { data, error } = await sb
        .from("v_sales_cycle_by_owner")
        .select("*")
        .order("revenue_won", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OwnerPerformanceRow[];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// 3. Tempo médio em cada etapa
// ============================================================
export interface TimeInStageRow {
  stage: string;
  sample_size: number;
  avg_days: number | null;
  p50_days: number | null;
  p90_days: number | null;
  min_days: number | null;
  max_days: number | null;
}

export function useTimeInStageGodMode() {
  return useQuery({
    queryKey: ["sales-kpis", "time-in-stage"],
    queryFn: async (): Promise<TimeInStageRow[]> => {
      const { data, error } = await sb
        .from("v_sales_time_in_stage")
        .select("*")
        .order("avg_days", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeInStageRow[];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// 4. Conversão por segmento
// ============================================================
export type SegmentDimension =
  | "metragem"
  | "location_type"
  | "property_type"
  | "lead_source";

export interface SegmentRow {
  segment: string;
  total_leads: number;
  proposals_sent: number;
  deals_won: number;
  deals_lost: number;
  deals_open: number;
  win_rate_pct: number;
  proposal_rate_pct: number;
  avg_cycle_days: number | null;
  avg_deal_size_won: number | null;
  revenue_won: number;
}

export function useSalesBySegment(dimension: SegmentDimension) {
  return useQuery({
    queryKey: ["sales-kpis", "by-segment", dimension],
    queryFn: async (): Promise<SegmentRow[]> => {
      const { data, error } = await sb.rpc("sales_conversion_by_segment", {
        _dimension: dimension,
      });
      if (error) throw error;
      return (data ?? []) as SegmentRow[];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// 5. Coortes mensais
// ============================================================
export interface CohortRow {
  cohort_month: string; // ISO date
  leads: number;
  proposals_sent: number;
  deals_won: number;
  deals_lost: number;
  lead_to_won_pct: number;
  avg_cycle_days: number | null;
  revenue_won: number;
}

export function useSalesCohorts() {
  return useQuery({
    queryKey: ["sales-kpis", "cohorts"],
    queryFn: async (): Promise<CohortRow[]> => {
      const { data, error } = await sb
        .from("v_sales_cohort_monthly")
        .select("*")
        .order("cohort_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CohortRow[];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// 6. Motivos de perda
// ============================================================
export interface LostReasonRow {
  reason: string;
  qty: number;
  pct_of_lost: number;
  revenue_lost: number;
  avg_deal_size: number | null;
  competitor_value_total: number;
}

const LOST_REASON_LABELS: Record<string, string> = {
  preco: "Preço",
  escopo: "Escopo",
  concorrente: "Concorrente",
  timing: "Timing",
  sem_retorno: "Sem retorno",
  desistencia: "Desistência",
  outro: "Outro",
};

export function lostReasonLabel(key: string): string {
  return LOST_REASON_LABELS[key] ?? key;
}

export function useLostReasonsRanked() {
  return useQuery({
    queryKey: ["sales-kpis", "lost-reasons"],
    queryFn: async (): Promise<LostReasonRow[]> => {
      const { data, error } = await sb
        .from("v_sales_lost_reasons_ranked")
        .select("*");
      if (error) throw error;
      return (data ?? []) as LostReasonRow[];
    },
    staleTime: 60_000,
  });
}

// ============================================================
// Helpers de formatação
// ============================================================
export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 10) / 10} d`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(Math.round(value * 10) / 10).toLocaleString("pt-BR")}%`;
}

const STAGE_LABELS: Record<string, string> = {
  novo: "Novo",
  mql: "MQL",
  lead: "Lead",
  requested: "Solicitado",
  triage: "Triagem",
  assigned: "Atribuído",
  qualificacao: "Qualificação",
  validacao_briefing: "Validação de briefing",
  em_analise: "Em análise",
  in_progress: "Em produção",
  waiting_info: "Aguardando info",
  aguardando_info: "Aguardando info",
  ready_for_review: "Pronto p/ revisão",
  em_revisao: "Em revisão",
  revision_requested: "Revisão solicitada",
  delivered_to_sales: "Entregue ao comercial",
  sent_to_client: "Enviado ao cliente",
  published: "Publicado",
  minuta_solicitada: "Minuta solicitada",
  contrato_fechado: "Contrato fechado",
  lost: "Perdido",
  perdido: "Perdido",
  archived: "Arquivado",
};

export function stageLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return STAGE_LABELS[key] ?? key;
}
