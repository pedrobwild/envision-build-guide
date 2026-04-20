/**
 * Lead Scoring — Onda 5A (Inteligência de Cliente)
 *
 * Calcula um score 0-100 que representa a "qualidade" e o "engajamento" de
 * um cliente, combinando sinais comportamentais e de pipeline.
 *
 * Sinais (peso):
 * - Volume de orçamentos          (até 15 pts)
 * - Valor médio (ticket)          (até 20 pts)
 * - Engajamento recente           (até 25 pts)
 * - Velocidade no pipeline        (até 15 pts)
 * - Conversão histórica           (até 25 pts)
 *
 * Tier:
 *  - hot   >= 70
 *  - warm  >= 40
 *  - cold   < 40
 */

import { differenceInCalendarDays } from "date-fns";

export type LeadTier = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  total_budgets: number | null;
  won_budgets: number | null;
  active_budgets: number | null;
  avg_ticket: number | null;
  pipeline_value: number | null;
  total_won_value: number | null;
  last_budget_at: string | null;
  /** Dias desde a última atividade registrada (qualquer orçamento). null se nunca houve. */
  days_since_last_activity: number | null;
  /** internal_status do orçamento mais recente. */
  latest_internal_status: string | null;
}

export interface LeadScoreBreakdown {
  volume: number;
  ticket: number;
  recency: number;
  pipeline_velocity: number;
  conversion: number;
}

export interface LeadScoreResult {
  score: number;
  tier: LeadTier;
  breakdown: LeadScoreBreakdown;
  /** Frase curta que explica por que o cliente é hot/warm/cold. */
  reason: string;
}

// Limiares
const HOT_THRESHOLD = 70;
const WARM_THRESHOLD = 40;

// Buckets de tempo desde última atividade
function recencyPoints(daysSince: number | null, lastBudgetAt: string | null): number {
  // Se nunca teve atividade nem orçamento, score baixo
  if (daysSince === null && !lastBudgetAt) return 0;
  // Usa o sinal mais recente disponível
  let days = daysSince;
  if (days === null && lastBudgetAt) {
    days = differenceInCalendarDays(new Date(), new Date(lastBudgetAt));
  }
  if (days === null) return 0;
  if (days <= 3) return 25;
  if (days <= 7) return 20;
  if (days <= 14) return 14;
  if (days <= 30) return 8;
  if (days <= 60) return 3;
  return 0;
}

function volumePoints(total: number | null): number {
  const t = total ?? 0;
  if (t >= 4) return 15;
  if (t === 3) return 12;
  if (t === 2) return 8;
  if (t === 1) return 4;
  return 0;
}

function ticketPoints(avg: number | null): number {
  const v = avg ?? 0;
  if (v >= 500_000) return 20;
  if (v >= 250_000) return 16;
  if (v >= 120_000) return 12;
  if (v >= 60_000) return 8;
  if (v >= 20_000) return 4;
  return 0;
}

// Estágios "quentes" no funil — proximidade do fechamento
const HOT_STAGES = new Set([
  "minuta_solicitada",
  "negociacao",
  "ready_for_review",
  "delivered_to_sales",
  "published",
  "sent_to_client",
]);
const MID_STAGES = new Set([
  "em_revisao",
  "in_progress",
  "em_analise",
  "validacao_briefing",
]);
const LOW_STAGES = new Set(["mql", "novo", "lead", "qualificacao", "requested", "triage", "assigned"]);
const DEAD_STAGES = new Set(["lost", "perdido", "archived"]);

function pipelineVelocityPoints(latestStatus: string | null, activeCount: number | null): number {
  if (!latestStatus) return 0;
  if (DEAD_STAGES.has(latestStatus)) return 0;
  if (latestStatus === "contrato_fechado") return 15;
  if (HOT_STAGES.has(latestStatus)) return 14;
  if (MID_STAGES.has(latestStatus)) return 9;
  if (LOW_STAGES.has(latestStatus)) return 4;
  // Bônus pequeno se tem múltiplos negócios ativos
  return (activeCount ?? 0) > 1 ? 6 : 3;
}

function conversionPoints(won: number | null, total: number | null): number {
  const w = won ?? 0;
  const t = total ?? 0;
  if (w === 0) return 0;
  if (t === 0) return 0;
  // Cliente recorrente (>=2 ganhos) é o estado ideal
  if (w >= 2) return 25;
  // Já fechou ao menos 1 vez
  if (w === 1) return 18;
  return 0;
}

function buildReason(breakdown: LeadScoreBreakdown, tier: LeadTier, input: LeadScoreInput): string {
  if (input.latest_internal_status === "contrato_fechado" && (input.won_budgets ?? 0) >= 2) {
    return "Cliente recorrente — múltiplos contratos fechados";
  }
  if (input.latest_internal_status === "contrato_fechado") {
    return "Cliente ativo — contrato em andamento";
  }
  const hi = (Object.entries(breakdown) as [keyof LeadScoreBreakdown, number][])
    .sort((a, b) => b[1] - a[1])[0];
  const labels: Record<keyof LeadScoreBreakdown, string> = {
    volume: "histórico de orçamentos",
    ticket: "ticket médio elevado",
    recency: "atividade recente",
    pipeline_velocity: "avanço no funil",
    conversion: "histórico de conversão",
  };
  if (tier === "hot") return `Quente — destaque em ${labels[hi[0]]}`;
  if (tier === "warm") return `Morno — engajamento moderado (${labels[hi[0]]})`;
  if (input.days_since_last_activity !== null && input.days_since_last_activity > 30) {
    return `Frio — sem contato há ${input.days_since_last_activity} dias`;
  }
  return "Frio — pouco engajamento até o momento";
}

export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  const breakdown: LeadScoreBreakdown = {
    volume: volumePoints(input.total_budgets),
    ticket: ticketPoints(input.avg_ticket),
    recency: recencyPoints(input.days_since_last_activity, input.last_budget_at),
    pipeline_velocity: pipelineVelocityPoints(input.latest_internal_status, input.active_budgets),
    conversion: conversionPoints(input.won_budgets, input.total_budgets),
  };

  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        breakdown.volume +
          breakdown.ticket +
          breakdown.recency +
          breakdown.pipeline_velocity +
          breakdown.conversion,
      ),
    ),
  );

  const tier: LeadTier = score >= HOT_THRESHOLD ? "hot" : score >= WARM_THRESHOLD ? "warm" : "cold";

  return { score, tier, breakdown, reason: buildReason(breakdown, tier, input) };
}

export const TIER_META: Record<LeadTier, { label: string; emoji: string; color: string }> = {
  hot: { label: "Quente", emoji: "🔥", color: "text-destructive" },
  warm: { label: "Morno", emoji: "🌤", color: "text-warning" },
  cold: { label: "Frio", emoji: "❄️", color: "text-muted-foreground" },
};
