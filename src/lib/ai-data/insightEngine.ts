/**
 * Motor de insights — transforma dados brutos do BWild em uma coleção
 * heterogênea de insights (descritivos, diagnósticos, preditivos,
 * prescritivos, financeiros, operacionais, de funil, de qualidade de
 * dados e geográficos).
 *
 * Decisões de design:
 *  - Funções puras: recebem dados, retornam insights. Sem fetch.
 *  - Defensivo a dados ausentes: cada gerador retorna [] quando os dados
 *    são insuficientes e adiciona uma `limitation` explícita no resultado.
 *  - Sem invenção: nunca extrapola números — quando uma série tem 1 ponto,
 *    o gerador preditivo emite uma limitação ao invés de "inventar" trend.
 *  - Extensível: cada categoria tem seu próprio gerador. Para adicionar um
 *    novo tipo, exporte uma função `generate<Tipo>Insights` e some ao
 *    `runInsightEngine`.
 */

import type { BudgetWithSections, ProfileRow } from "@/types/budget-common";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import type {
  Insight,
  InsightSeverity,
  InsightType,
  AnalysisContext,
  AnalysisResult,
} from "./types";
import {
  mean,
  median,
  percentChange,
  topNCount,
  topNSum,
  paretoCut,
  outliers,
  linearTrend,
  projectLinear,
  movingAverage,
  stdDev,
} from "./statistics";
import { rankInsights } from "./insightScoring";
import { recommendVisualization } from "./visualizationRecommender";
import { METRIC_DEFINITIONS } from "./metricDefinitions";
import { STATUS_GROUPS } from "@/lib/role-constants";
import type { Tables } from "@/integrations/supabase/types";

const DELIVERED_STATUSES = ["sent_to_client", "minuta_solicitada", "contrato_fechado"] as const;
const ACTIVE_STATUSES = STATUS_GROUPS.OPERATIONS_ACTIVE;

export interface EngineInput {
  budgets: BudgetWithSections[];
  profiles?: Record<string, string>;
  /** Eventos brutos para análises de tempo em estágio (opcional). */
  events?: Pick<Tables<"budget_events">, "budget_id" | "event_type" | "from_status" | "to_status" | "created_at">[];
  /** Motivos de perda já carregados (opcional). */
  lostReasons?: Pick<Tables<"budget_lost_reasons">, "budget_id" | "reason_category" | "competitor_name" | "competitor_value" | "lost_at">[];
  /** Snapshots históricos para tendências confiáveis. */
  snapshots?: Pick<Tables<"daily_metrics_snapshot">, "generated_at" | "received_count" | "closed_count" | "revenue_brl" | "conversion_rate_pct" | "gross_margin_pct" | "health_score">[];
  /** Range em análise. */
  range: { from: Date; to: Date };
  /** Range comparativo (default: período anterior do mesmo tamanho). */
  previousRange?: { from: Date; to: Date };
}

interface EngineNumbers {
  receivedCurrent: number;
  receivedPrev: number;
  backlogCount: number;
  overdueList: BudgetWithSections[];
  slaPct: number;
  avgLeadTime: number | null;
  medianLeadTime: number | null;
  prevAvgLeadTime: number | null;
  conversion: number | null;
  prevConversion: number | null;
  closedCurrent: BudgetWithSections[];
  closedPrev: BudgetWithSections[];
  publishedCurrent: BudgetWithSections[];
  revenueCurrent: number;
  revenuePrev: number;
  costCurrent: number;
  marginPct: number | null;
  prevMarginPct: number | null;
  ticketAvg: number | null;
  portfolioValue: number;
  weightedPipeline: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function inRange(date: string | null | undefined, range: { from: Date; to: Date }): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

function daysBetween(a: string | Date, b: string | Date): number {
  const ta = typeof a === "string" ? new Date(a).getTime() : a.getTime();
  const tb = typeof b === "string" ? new Date(b).getTime() : b.getTime();
  return Math.max(0, (tb - ta) / 86_400_000);
}

function previousRangeFor(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()) };
}

function budgetTotal(b: BudgetWithSections & { computed_total?: number | null }): number {
  if (typeof b.computed_total === "number" && Number.isFinite(b.computed_total)) {
    return b.computed_total;
  }
  if (typeof b.manual_total === "number" && Number.isFinite(b.manual_total) && b.manual_total > 0) {
    return b.manual_total;
  }
  const sectionsTotal = (b.sections ?? []).reduce((acc, s) => acc + calculateSectionSubtotal(s), 0);
  const adjTotal = (b.adjustments ?? []).reduce((acc, a) => acc + a.sign * Number(a.amount ?? 0), 0);
  return sectionsTotal + adjTotal;
}

function budgetCost(b: BudgetWithSections): number {
  return Number(b.internal_cost ?? 0);
}

/** Probabilidade aproximada de fechamento por etapa — usado no pipeline ponderado. */
const STAGE_WIN_PROBABILITY: Record<string, number> = {
  sent_to_client: 0.35,
  revision_requested: 0.45,
  minuta_solicitada: 0.7,
  contrato_fechado: 1.0,
  delivered_to_sales: 0.25,
  ready_for_review: 0.15,
  in_progress: 0.1,
  waiting_info: 0.08,
  triage: 0.05,
  assigned: 0.07,
  novo: 0.05,
  requested: 0.05,
};

function weightedValue(b: BudgetWithSections): number {
  const p = STAGE_WIN_PROBABILITY[b.internal_status] ?? 0;
  return budgetTotal(b) * p;
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Métricas centrais ───────────────────────────────────────────────────

function computeNumbers(input: EngineInput): EngineNumbers {
  const { budgets, range } = input;
  const prevRange = input.previousRange ?? previousRangeFor(range);
  const now = new Date();

  const receivedCurrent = budgets.filter((b) => inRange(b.created_at, range)).length;
  const receivedPrev = budgets.filter((b) => inRange(b.created_at, prevRange)).length;

  const backlog = budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status as (typeof ACTIVE_STATUSES)[number]));
  const overdueList = backlog.filter((b) => b.due_at && new Date(b.due_at) < now);
  const slaPct = backlog.length > 0 ? ((backlog.length - overdueList.length) / backlog.length) * 100 : 100;

  const deliveredCurrent = budgets.filter(
    (b) =>
      DELIVERED_STATUSES.includes(b.internal_status as (typeof DELIVERED_STATUSES)[number]) &&
      inRange(b.updated_at ?? b.closed_at ?? b.generated_at, range),
  );
  const deliveredPrev = budgets.filter(
    (b) =>
      DELIVERED_STATUSES.includes(b.internal_status as (typeof DELIVERED_STATUSES)[number]) &&
      inRange(b.updated_at ?? b.closed_at ?? b.generated_at, prevRange),
  );

  const leadTimes = deliveredCurrent
    .map((b) => (b.created_at ? daysBetween(b.created_at, b.updated_at ?? b.closed_at ?? new Date()) : NaN))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 365);
  const prevLeadTimes = deliveredPrev
    .map((b) => (b.created_at ? daysBetween(b.created_at, b.updated_at ?? b.closed_at ?? new Date()) : NaN))
    .filter((v) => Number.isFinite(v) && v > 0 && v < 365);

  const closedCurrent = budgets.filter(
    (b) => b.internal_status === "contrato_fechado" && inRange(b.closed_at ?? b.updated_at, range),
  );
  const closedPrev = budgets.filter(
    (b) => b.internal_status === "contrato_fechado" && inRange(b.closed_at ?? b.updated_at, prevRange),
  );
  const publishedCurrent = deliveredCurrent;

  const conversion = publishedCurrent.length > 0 ? (closedCurrent.length / publishedCurrent.length) * 100 : null;
  const prevConversion = deliveredPrev.length > 0 ? (closedPrev.length / deliveredPrev.length) * 100 : null;

  const revenueCurrent = closedCurrent.reduce((acc, b) => acc + budgetTotal(b), 0);
  const revenuePrev = closedPrev.reduce((acc, b) => acc + budgetTotal(b), 0);
  const costCurrent = closedCurrent.reduce((acc, b) => acc + budgetCost(b), 0);
  const costPrev = closedPrev.reduce((acc, b) => acc + budgetCost(b), 0);
  const marginPct = revenueCurrent > 0 ? ((revenueCurrent - costCurrent) / revenueCurrent) * 100 : null;
  const prevMarginPct = revenuePrev > 0 ? ((revenuePrev - costPrev) / revenuePrev) * 100 : null;
  const ticketAvg = closedCurrent.length > 0 ? revenueCurrent / closedCurrent.length : null;

  const portfolioValue = backlog.reduce((acc, b) => acc + budgetTotal(b), 0);
  const weightedPipeline = backlog.reduce((acc, b) => acc + weightedValue(b), 0);

  return {
    receivedCurrent,
    receivedPrev,
    backlogCount: backlog.length,
    overdueList,
    slaPct,
    avgLeadTime: mean(leadTimes),
    medianLeadTime: median(leadTimes),
    prevAvgLeadTime: mean(prevLeadTimes),
    conversion,
    prevConversion,
    closedCurrent,
    closedPrev,
    publishedCurrent,
    revenueCurrent,
    revenuePrev,
    costCurrent,
    marginPct,
    prevMarginPct,
    ticketAvg,
    portfolioValue,
    weightedPipeline,
  };
}

// ─── Geradores por categoria ─────────────────────────────────────────────

export function generateDescriptiveInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];
  const change = percentChange(n.receivedCurrent, n.receivedPrev);
  if (n.receivedCurrent > 0) {
    out.push({
      id: id("desc-received"),
      type: "descriptive",
      title: `Volume recebido: ${n.receivedCurrent} orçamentos no período`,
      summary: change == null
        ? `Recebemos ${n.receivedCurrent} orçamentos no período analisado.`
        : `Recebemos ${n.receivedCurrent} orçamentos, ${change >= 0 ? "alta" : "queda"} de ${Math.abs(change).toFixed(1)}% versus o período anterior (${n.receivedPrev}).`,
      severity: "info",
      confidence: 0.95,
      evidence: [
        { label: "Recebidos no período", value: n.receivedCurrent },
        { label: "Período anterior", value: n.receivedPrev, change: change ?? undefined },
      ],
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "received_count",
    });
  }

  if (n.ticketAvg !== null) {
    out.push({
      id: id("desc-ticket"),
      type: "descriptive",
      title: `Ticket médio: R$ ${n.ticketAvg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
      summary: `Ticket médio dos ${n.closedCurrent.length} contrato${n.closedCurrent.length === 1 ? "" : "s"} fechado${n.closedCurrent.length === 1 ? "" : "s"} no período.`,
      severity: "info",
      confidence: n.closedCurrent.length >= 3 ? 0.85 : 0.6,
      evidence: [
        { label: "Ticket médio", value: n.ticketAvg },
        { label: "Contratos fechados", value: n.closedCurrent.length },
      ],
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "avg_ticket_brl",
      limitations: n.closedCurrent.length < 3 ? ["Poucos fechamentos no período — ticket pouco representativo."] : [],
    });
  }

  // Distribuição por status
  const backlog = input.budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status as (typeof ACTIVE_STATUSES)[number]));
  if (backlog.length > 0) {
    const top = topNCount(backlog, (b) => b.internal_status, 5);
    out.push({
      id: id("desc-status-dist"),
      type: "descriptive",
      title: "Distribuição do backlog por status",
      summary: `Backlog de ${backlog.length} itens concentrado principalmente em ${top[0]?.key} (${top[0]?.count}).`,
      severity: "info",
      confidence: 0.95,
      evidence: top.map((t) => ({ label: t.key, value: t.count })),
      visualization: {
        type: "bar",
        x: "status",
        y: "qtd",
        data: top.map((t) => ({ status: t.key, qtd: t.count })),
      },
      entity: "budgets",
    });
  }

  // Top clientes por receita
  if (n.closedCurrent.length > 0) {
    const top = topNSum(n.closedCurrent, (b) => b.client_name, (b) => budgetTotal(b), 5);
    out.push({
      id: id("desc-top-clients"),
      type: "descriptive",
      title: "Top clientes por receita no período",
      summary: top[0] ? `${top[0].key} lidera com R$ ${top[0].total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.` : "Sem fechamentos para ranquear.",
      severity: "info",
      confidence: 0.9,
      evidence: top.map((t) => ({ label: t.key, value: t.total })),
      visualization: {
        type: "bar",
        x: "cliente",
        y: "receita",
        data: top.map((t) => ({ cliente: t.key, receita: t.total })),
      },
      entity: "budgets",
    });
  }

  return out;
}

export function generateComparativeInsights(_input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];
  const revChange = percentChange(n.revenueCurrent, n.revenuePrev);
  if (revChange !== null && (n.revenueCurrent > 0 || n.revenuePrev > 0)) {
    const severity: InsightSeverity = revChange <= -25 ? "high" : revChange <= -10 ? "medium" : revChange >= 25 ? "info" : "low";
    out.push({
      id: id("cmp-revenue"),
      type: "comparative",
      title: revChange >= 0 ? `Receita cresceu ${revChange.toFixed(1)}% vs anterior` : `Receita caiu ${Math.abs(revChange).toFixed(1)}% vs anterior`,
      summary: `Receita atual R$ ${n.revenueCurrent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} versus R$ ${n.revenuePrev.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} anterior.`,
      severity,
      confidence: 0.85,
      evidence: [
        { label: "Receita atual", value: n.revenueCurrent },
        { label: "Receita anterior", value: n.revenuePrev, change: revChange },
      ],
      visualization: { type: "bar", data: [{ label: "Anterior", valor: n.revenuePrev }, { label: "Atual", valor: n.revenueCurrent }] },
      entity: "budgets",
      metricId: "revenue_brl",
    });
  }

  const convChange = percentChange(n.conversion, n.prevConversion);
  if (n.conversion !== null) {
    out.push({
      id: id("cmp-conv"),
      type: "comparative",
      title: convChange == null
        ? `Conversão atual: ${n.conversion.toFixed(1)}%`
        : convChange >= 0
          ? `Conversão subiu ${convChange.toFixed(1)} p.p.`
          : `Conversão caiu ${Math.abs(convChange).toFixed(1)} p.p.`,
      summary: `Conversão de ${n.conversion.toFixed(1)}% no período (${(n.prevConversion ?? 0).toFixed(1)}% anterior).`,
      severity: n.conversion < 15 ? "high" : n.conversion < 25 ? "medium" : "info",
      confidence: 0.8,
      evidence: [
        { label: "Conversão atual", value: `${n.conversion.toFixed(1)}%` },
        { label: "Conversão anterior", value: `${(n.prevConversion ?? 0).toFixed(1)}%`, change: convChange ?? undefined },
      ],
      visualization: { type: "bar", data: [{ label: "Anterior", valor: n.prevConversion ?? 0 }, { label: "Atual", valor: n.conversion }] },
      entity: "budgets",
      metricId: "conversion_rate",
    });
  }

  return out;
}

export function generateDiagnosticInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];
  const backlog = input.budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status as (typeof ACTIVE_STATUSES)[number]));

  // Gargalo: estágio com maior tempo médio parado
  const stageStats = new Map<string, number[]>();
  for (const b of backlog) {
    if (!b.updated_at) continue;
    const days = daysBetween(b.updated_at, new Date());
    const arr = stageStats.get(b.internal_status) ?? [];
    arr.push(days);
    stageStats.set(b.internal_status, arr);
  }
  const stages = [...stageStats.entries()]
    .map(([status, list]) => ({ status, avg: mean(list) ?? 0, count: list.length }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.avg - a.avg);
  if (stages.length > 0 && stages[0].avg >= 5) {
    const worst = stages[0];
    out.push({
      id: id("diag-bottleneck"),
      type: "diagnostic",
      title: `Gargalo em "${worst.status}" — média de ${worst.avg.toFixed(1)} dias parados`,
      summary: `O estágio ${worst.status} tem ${worst.count} itens parados há ${worst.avg.toFixed(1)} dias em média. Costuma indicar gargalo no processo.`,
      severity: worst.avg >= 10 ? "high" : "medium",
      confidence: worst.count >= 3 ? 0.8 : 0.6,
      evidence: stages.slice(0, 5).map((s) => ({ label: s.status, value: `${s.count} itens · ${s.avg.toFixed(1)}d` })),
      recommendedAction: `Inspecionar os ${worst.count} itens em ${worst.status} para identificar bloqueio comum.`,
      visualization: {
        type: "bar",
        x: "estagio",
        y: "dias",
        data: stages.slice(0, 6).map((s) => ({ estagio: s.status, dias: Number(s.avg.toFixed(1)) })),
      },
      entity: "budgets",
      metricId: "stalled_count",
    });
  }

  // Outliers de valor
  if (n.closedCurrent.length >= 4) {
    const totals = n.closedCurrent.map(budgetTotal);
    const idxs = outliers(totals);
    if (idxs.length > 0) {
      const items = idxs.map((i) => ({ name: n.closedCurrent[i].project_name, value: totals[i] }));
      out.push({
        id: id("diag-outliers"),
        type: "diagnostic",
        title: `${idxs.length} contrato${idxs.length === 1 ? "" : "s"} com valor fora do padrão`,
        summary: `Detectados ${idxs.length} fechamentos fora do desvio típico — investigar para entender se é cliente especial ou erro de precificação.`,
        severity: "low",
        confidence: 0.7,
        evidence: items.map((it) => ({ label: it.name, value: it.value })),
        visualization: { type: "table" },
        entity: "budgets",
      });
    }
  }

  return out;
}

export function generateFunnelInsights(input: EngineInput, _n: EngineNumbers): Insight[] {
  const out: Insight[] = [];
  const inPeriod = input.budgets.filter((b) => inRange(b.created_at, input.range));
  if (inPeriod.length < 3) return out;

  const FLOW: string[] = [
    "novo", "requested", "triage", "assigned", "in_progress", "ready_for_review",
    "delivered_to_sales", "sent_to_client", "minuta_solicitada", "contrato_fechado",
  ];
  const stages = [
    { key: "received", label: "Recebido", min: "novo" },
    { key: "in_progress", label: "Em produção", min: "in_progress" },
    { key: "review", label: "Revisão", min: "ready_for_review" },
    { key: "delivered", label: "Entregue", min: "delivered_to_sales" },
    { key: "sent", label: "Enviado", min: "sent_to_client" },
    { key: "minuta", label: "Minuta", min: "minuta_solicitada" },
    { key: "closed", label: "Fechado", min: "contrato_fechado" },
  ];
  const counts = stages.map((s) => {
    const minIdx = FLOW.indexOf(s.min);
    return inPeriod.filter((b) => FLOW.indexOf(b.internal_status) >= minIdx).length;
  });

  out.push({
    id: id("funnel-volumes"),
    type: "funnel",
    title: "Funil completo do período",
    summary: `Lote de ${counts[0]} orçamentos chegou ao recebimento; ${counts[counts.length - 1]} foram fechados.`,
    severity: "info",
    confidence: 0.9,
    evidence: stages.map((s, i) => ({ label: s.label, value: counts[i] })),
    visualization: {
      type: "funnel",
      data: stages.map((s, i) => ({ etapa: s.label, qtd: counts[i] })),
      x: "etapa",
      y: "qtd",
    },
    entity: "budgets",
  });

  // Maior queda entre etapas
  const drops = stages.map((s, i) => ({ stage: s.label, drop: i === 0 ? 0 : Math.max(0, counts[i - 1] - counts[i]), pass: i > 0 && counts[i - 1] > 0 ? counts[i] / counts[i - 1] : 1 }));
  drops.shift();
  drops.sort((a, b) => a.pass - b.pass);
  const worst = drops[0];
  if (worst && worst.pass < 0.6) {
    out.push({
      id: id("funnel-worst"),
      type: "funnel",
      title: `Maior perda do funil: → ${worst.stage}`,
      summary: `Apenas ${(worst.pass * 100).toFixed(0)}% chegam a "${worst.stage}". Foco aqui tem maior alavancagem de receita.`,
      severity: worst.pass < 0.3 ? "high" : "medium",
      confidence: 0.75,
      evidence: drops.slice(0, 3).map((d) => ({ label: d.stage, value: `${(d.pass * 100).toFixed(0)}% passa` })),
      recommendedAction: `Revisar critérios e bloqueios na transição para "${worst.stage}".`,
      visualization: {
        type: "bar",
        data: drops.map((d) => ({ etapa: d.stage, pass: Number((d.pass * 100).toFixed(0)) })),
        x: "etapa",
        y: "pass",
      },
      entity: "budgets",
    });
  }

  return out;
}

export function generateFinancialInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];

  if (n.marginPct !== null) {
    const severity: InsightSeverity = n.marginPct < 5 ? "critical" : n.marginPct < 15 ? "high" : n.marginPct < 22 ? "medium" : "info";
    out.push({
      id: id("fin-margin"),
      type: "financial",
      title: `Margem bruta de ${n.marginPct.toFixed(1)}%`,
      summary: `Receita R$ ${n.revenueCurrent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} · Custo R$ ${n.costCurrent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
      severity,
      confidence: n.closedCurrent.length >= 3 ? 0.85 : 0.6,
      evidence: [
        { label: "Margem %", value: `${n.marginPct.toFixed(1)}%`, change: percentChange(n.marginPct, n.prevMarginPct) ?? undefined },
        { label: "Receita", value: n.revenueCurrent },
        { label: "Custo", value: n.costCurrent },
      ],
      recommendedAction: severity === "critical"
        ? "Suspender precificação atual e revisar custos antes de novos contratos."
        : severity === "high"
          ? "Revisar BDI e margens dos próximos orçamentos."
          : undefined,
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "gross_margin_pct",
      limitations: n.closedCurrent.some((b) => !b.internal_cost) ? ["Alguns contratos sem custo registrado — margem aproximada."] : [],
    });
  }

  // Pareto de clientes
  if (n.closedCurrent.length >= 4) {
    const byClient = topNSum(n.closedCurrent, (b) => b.client_name, (b) => budgetTotal(b), 100);
    const totals = byClient.map((c) => c.total);
    const pareto = paretoCut(totals, 0.8);
    if (pareto.topN > 0) {
      out.push({
        id: id("fin-pareto"),
        type: "financial",
        title: `${pareto.topN} clientes geram ${(pareto.share * 100).toFixed(0)}% da receita`,
        summary: `Concentração de Pareto: ${pareto.topN}/${byClient.length} clientes respondem por ${(pareto.share * 100).toFixed(0)}% da receita do período.`,
        severity: pareto.topN <= Math.max(2, Math.floor(byClient.length * 0.1)) ? "medium" : "low",
        confidence: 0.85,
        evidence: byClient.slice(0, pareto.topN).map((c) => ({ label: c.key, value: c.total })),
        recommendedAction: pareto.topN <= 3 ? "Diversificar carteira para reduzir dependência dos top clientes." : undefined,
        visualization: { type: "bar", data: byClient.slice(0, 10).map((c) => ({ cliente: c.key, receita: c.total })), x: "cliente", y: "receita" },
        entity: "budgets",
      });
    }
  }

  // Pipeline ponderado vs valor bruto
  if (n.portfolioValue > 0) {
    const ratio = n.weightedPipeline / n.portfolioValue;
    out.push({
      id: id("fin-pipeline"),
      type: "financial",
      title: `Pipeline R$ ${n.portfolioValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} (ponderado R$ ${n.weightedPipeline.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`,
      summary: `Pipeline ponderado representa ${(ratio * 100).toFixed(0)}% do valor bruto — quanto maior a razão, mais maduro o pipeline.`,
      severity: "info",
      confidence: 0.75,
      evidence: [
        { label: "Pipeline bruto", value: n.portfolioValue },
        { label: "Pipeline ponderado", value: n.weightedPipeline },
        { label: "Maturidade", value: `${(ratio * 100).toFixed(0)}%` },
      ],
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "weighted_pipeline_brl",
      limitations: ["Probabilidades por etapa são heurísticas globais — ajustáveis por pipeline."],
    });
  }

  return out;
}

export function generateOperationalInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];
  if (n.overdueList.length > 0) {
    const value = n.overdueList.reduce((acc, b) => acc + budgetTotal(b), 0);
    out.push({
      id: id("op-overdue"),
      type: "operational",
      title: `${n.overdueList.length} orçamento${n.overdueList.length > 1 ? "s" : ""} vencido${n.overdueList.length > 1 ? "s" : ""}`,
      summary: `Há ${n.overdueList.length} itens fora do prazo, somando R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} em pipeline travado.`,
      severity: n.overdueList.length >= 5 ? "critical" : "high",
      confidence: 0.95,
      evidence: n.overdueList.slice(0, 5).map((b) => ({ label: b.project_name || b.client_name, value: b.due_at ?? "—" })),
      recommendedAction: "Repactuar prazos e reatribuir os itens mais críticos.",
      visualization: { type: "table" },
      entity: "budgets",
      metricId: "overdue_count",
    });
  }

  if (n.slaPct < 80) {
    out.push({
      id: id("op-sla"),
      type: "operational",
      title: `SLA em ${n.slaPct.toFixed(0)}% — abaixo da meta de 80%`,
      summary: `Apenas ${n.slaPct.toFixed(0)}% do backlog está dentro do prazo. Operação opera no vermelho.`,
      severity: n.slaPct < 60 ? "critical" : "high",
      confidence: 0.9,
      evidence: [
        { label: "SLA atual", value: `${n.slaPct.toFixed(0)}%` },
        { label: "Backlog", value: n.backlogCount },
      ],
      recommendedAction: "Priorizar entregas vencidas antes de qualquer novo trabalho.",
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "sla_on_time_pct",
    });
  }

  // Ranking de equipe
  if (input.profiles && Object.keys(input.profiles).length > 0) {
    const teamMap = new Map<string, { name: string; active: number; overdue: number }>();
    const backlog = input.budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status as (typeof ACTIVE_STATUSES)[number]));
    const now = new Date();
    for (const b of backlog) {
      const oid = b.estimator_owner_id;
      if (!oid) continue;
      const cur = teamMap.get(oid) ?? { name: input.profiles[oid] ?? "—", active: 0, overdue: 0 };
      cur.active += 1;
      if (b.due_at && new Date(b.due_at) < now) cur.overdue += 1;
      teamMap.set(oid, cur);
    }
    const team = [...teamMap.values()].sort((a, b) => b.overdue - a.overdue || b.active - a.active);
    if (team.length > 0) {
      const overloaded = team.filter((t) => t.active >= 5);
      if (overloaded.length > 0) {
        out.push({
          id: id("op-overload"),
          type: "operational",
          title: `${overloaded.length} orçamentista${overloaded.length > 1 ? "s" : ""} sobrecarregado${overloaded.length > 1 ? "s" : ""}`,
          summary: overloaded.map((t) => `${t.name} (${t.active})`).join(" · "),
          severity: "medium",
          confidence: 0.85,
          evidence: overloaded.map((t) => ({ label: t.name, value: `${t.active} ativos · ${t.overdue} vencidos` })),
          recommendedAction: "Redistribuir carga ou contratar reforço.",
          visualization: {
            type: "bar",
            data: team.slice(0, 8).map((t) => ({ pessoa: t.name, ativos: t.active, vencidos: t.overdue })),
            x: "pessoa",
            y: "ativos",
          },
          entity: "profiles",
        });
      }
    }
  }

  return out;
}

export function generatePredictiveInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];

  // Forecast por snapshots, se disponível
  if (input.snapshots && input.snapshots.length >= 4) {
    const series = [...input.snapshots]
      .sort((a, b) => new Date(a.generated_at).getTime() - new Date(b.generated_at).getTime())
      .map((s) => Number(s.revenue_brl ?? 0));
    const trend = linearTrend(series);
    if (trend) {
      const projection = projectLinear(series, 4);
      const next30 = projection.reduce((a, b) => a + Math.max(0, b), 0);
      out.push({
        id: id("pred-revenue"),
        type: "predictive",
        title: `Forecast: ~R$ ${next30.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} nos próximos ${projection.length} períodos`,
        summary: trend.slope >= 0 ? "Tendência positiva de receita." : "Tendência de queda na receita — atenção.",
        severity: trend.slope < 0 ? "medium" : "info",
        confidence: Math.max(0.4, Math.min(0.85, trend.r2)),
        evidence: [
          { label: "Inclinação", value: trend.slope.toFixed(2) },
          { label: "R²", value: trend.r2.toFixed(2) },
          { label: "Forecast total", value: next30 },
        ],
        visualization: {
          type: "line",
          data: [
            ...series.map((v, i) => ({ t: i, valor: v, tipo: "real" })),
            ...projection.map((v, i) => ({ t: series.length + i, valor: v, tipo: "previsto" })),
          ],
          x: "t",
          y: "valor",
          groupBy: "tipo",
        },
        entity: "budgets",
        metricId: "forecast_revenue_next_30d",
        limitations: trend.r2 < 0.4 ? ["Tendência tem baixo R² — projeção pouco confiável."] : [],
      });
    }
  } else {
    out.push({
      id: id("pred-limited"),
      type: "predictive",
      title: "Histórico curto para previsões confiáveis",
      summary: "São necessários pelo menos 4 snapshots diários consolidados para projeções estáveis.",
      severity: "info",
      confidence: 0.5,
      evidence: [{ label: "Snapshots disponíveis", value: input.snapshots?.length ?? 0 }],
      limitations: ["Forecast desabilitado por falta de série histórica."],
      visualization: { type: "kpi" },
      entity: "daily_metrics_snapshot",
    });
  }

  // Risco SLA próximos 7d
  const next7d = input.budgets.filter((b) => {
    if (!b.due_at) return false;
    const h = (new Date(b.due_at).getTime() - Date.now()) / 36e5;
    return h > 0 && h <= 168;
  });
  if (next7d.length > 0) {
    const breachRate = n.backlogCount > 0 ? n.overdueList.length / n.backlogCount : 0.1;
    const expected = Math.round(next7d.length * Math.max(0.1, breachRate));
    out.push({
      id: id("pred-sla7d"),
      type: "predictive",
      title: `Risco previsto: ${expected} possíveis estouros de SLA em 7 dias`,
      summary: `${next7d.length} orçamentos vencem em 7 dias. Estimativa baseada na taxa atual de breach (${(breachRate * 100).toFixed(0)}%).`,
      severity: expected >= 3 ? "high" : "medium",
      confidence: n.backlogCount >= 10 ? 0.7 : 0.5,
      evidence: [
        { label: "Vencem em 7d", value: next7d.length },
        { label: "Taxa atual de breach", value: `${(breachRate * 100).toFixed(0)}%` },
        { label: "Estimativa de estouros", value: expected },
      ],
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "overdue_count",
    });
  }

  // Tendência simples de recebimentos por moving average
  if (input.snapshots && input.snapshots.length >= 3) {
    const series = input.snapshots.map((s) => Number(s.received_count ?? 0));
    const ma = movingAverage(series, 3);
    const last = ma[ma.length - 1] ?? 0;
    const first = ma[Math.max(0, ma.length - 4)] ?? 0;
    const change = percentChange(last, first);
    if (change != null) {
      out.push({
        id: id("pred-demand"),
        type: "predictive",
        title: change >= 10 ? `Demanda em alta (+${change.toFixed(0)}%)` : change <= -10 ? `Demanda em queda (${change.toFixed(0)}%)` : "Demanda estável",
        summary: "Média móvel de recebimentos diários nos últimos snapshots.",
        severity: change <= -25 ? "medium" : "info",
        confidence: 0.7,
        evidence: [
          { label: "Média atual (MA3)", value: last.toFixed(1) },
          { label: "Média base (MA3)", value: first.toFixed(1), change },
        ],
        visualization: {
          type: "line",
          data: ma.map((v, i) => ({ t: i, ma: v })),
          x: "t",
          y: "ma",
        },
        entity: "budgets",
        metricId: "received_count",
      });
    }
  }

  return out;
}

export function generatePrescriptiveInsights(input: EngineInput, n: EngineNumbers): Insight[] {
  const out: Insight[] = [];

  // Itens parados em waiting_info
  const waiting = input.budgets.filter((b) => b.internal_status === "waiting_info");
  if (waiting.length >= 2) {
    const value = waiting.reduce((acc, b) => acc + budgetTotal(b), 0);
    out.push({
      id: id("pre-waiting"),
      type: "prescriptive",
      title: `Reabrir ${waiting.length} itens em "aguardando informação"`,
      summary: `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} travados aguardando retorno do cliente — ação direta de comercial pode destravar.`,
      severity: waiting.length >= 5 ? "high" : "medium",
      confidence: 0.85,
      evidence: waiting.slice(0, 5).map((b) => ({ label: b.project_name || b.client_name, value: b.client_name })),
      recommendedAction: "Disparar lembretes via WhatsApp/e-mail e marcar deadline.",
      visualization: { type: "table" },
      entity: "budgets",
    });
  }

  // Sugerir foco em margem
  if (n.marginPct !== null && n.marginPct < 18) {
    out.push({
      id: id("pre-margin"),
      type: "prescriptive",
      title: "Aumentar BDI nos próximos orçamentos",
      summary: `Margem atual em ${n.marginPct.toFixed(1)}% está abaixo do alvo (22%+). Subir BDI dos próximos orçamentos em 3–5 p.p. recupera saúde financeira.`,
      severity: "medium",
      confidence: 0.7,
      evidence: [{ label: "Margem atual", value: `${n.marginPct.toFixed(1)}%` }, { label: "Alvo", value: ">22%" }],
      recommendedAction: "Aplicar BDI mínimo padrão e revisar precificação dos itens com maior peso.",
      visualization: { type: "kpi" },
      entity: "budgets",
      metricId: "gross_margin_pct",
    });
  }

  // Conversão por origem (recomendar ampliação)
  const closed = n.closedCurrent;
  const all = n.publishedCurrent;
  if (all.length >= 5) {
    const conversionBySource = new Map<string, { total: number; closed: number }>();
    for (const b of all) {
      const src = b.lead_source ?? "—";
      const cur = conversionBySource.get(src) ?? { total: 0, closed: 0 };
      cur.total += 1;
      if (closed.find((c) => c.id === b.id)) cur.closed += 1;
      conversionBySource.set(src, cur);
    }
    const ranked = [...conversionBySource.entries()]
      .map(([src, v]) => ({ src, total: v.total, closed: v.closed, rate: v.total > 0 ? v.closed / v.total : 0 }))
      .filter((r) => r.total >= 2)
      .sort((a, b) => b.rate - a.rate);
    const best = ranked[0];
    if (best && best.rate > 0) {
      out.push({
        id: id("pre-source"),
        type: "prescriptive",
        title: `Ampliar investimento em "${best.src}" (conversão ${(best.rate * 100).toFixed(0)}%)`,
        summary: `Origem com melhor conversão entre as com volume relevante (${best.closed}/${best.total} fechados).`,
        severity: "info",
        confidence: 0.65,
        evidence: ranked.slice(0, 5).map((r) => ({ label: r.src, value: `${(r.rate * 100).toFixed(0)}%` })),
        recommendedAction: `Aumentar volume de leads em ${best.src} e replicar a abordagem para outras origens.`,
        visualization: {
          type: "bar",
          data: ranked.slice(0, 6).map((r) => ({ origem: r.src, conv: Number((r.rate * 100).toFixed(0)) })),
          x: "origem",
          y: "conv",
        },
        entity: "lead_sources",
      });
    }
  }

  return out;
}

export function generateDataQualityInsights(input: EngineInput): Insight[] {
  const out: Insight[] = [];
  const total = input.budgets.length;
  if (total === 0) return out;

  const missingCost = input.budgets.filter((b) => !b.internal_cost).length;
  const missingDue = input.budgets.filter((b) => !b.due_at && !["lost", "archived", "contrato_fechado"].includes(b.internal_status)).length;
  const missingSource = input.budgets.filter((b) => !b.lead_source).length;
  const missingClient = input.budgets.filter((b) => !b.client_id).length;

  const checks = [
    { field: "internal_cost", label: "Custo interno", missing: missingCost },
    { field: "due_at", label: "Prazo (due_at)", missing: missingDue },
    { field: "lead_source", label: "Origem do lead", missing: missingSource },
    { field: "client_id", label: "Vínculo com cliente", missing: missingClient },
  ];

  const completeness = checks.map((c) => ({ ...c, pct: 1 - c.missing / total }));
  const worst = [...completeness].sort((a, b) => a.pct - b.pct)[0];
  if (worst.pct < 0.85) {
    out.push({
      id: id("dq-missing"),
      type: "data_quality",
      title: `Campo "${worst.label}" preenchido em ${(worst.pct * 100).toFixed(0)}%`,
      summary: `${worst.missing} de ${total} orçamentos sem ${worst.label}. Reduz precisão de análises de margem, SLA e conversão por origem.`,
      severity: worst.pct < 0.5 ? "high" : "medium",
      confidence: 0.95,
      evidence: completeness.map((c) => ({ label: c.label, value: `${(c.pct * 100).toFixed(0)}%` })),
      recommendedAction: "Tornar o campo obrigatório no formulário de criação ou rodar enriquecimento manual.",
      visualization: { type: "table" },
      entity: "budgets",
      metricId: "data_completeness_pct",
    });
  }

  // Possível duplicidade por nome de cliente + cidade
  const map = new Map<string, number>();
  for (const b of input.budgets) {
    const k = `${b.client_name?.toLowerCase().trim() ?? ""}|${b.city?.toLowerCase().trim() ?? ""}`;
    if (!k.startsWith("|")) map.set(k, (map.get(k) ?? 0) + 1);
  }
  const dup = [...map.entries()].filter(([, v]) => v >= 3).slice(0, 5);
  if (dup.length > 0) {
    out.push({
      id: id("dq-dup"),
      type: "data_quality",
      title: `${dup.length} possíveis clientes duplicados`,
      summary: "Mesmo nome + cidade aparecem em múltiplos orçamentos. Pode indicar cadastro duplicado.",
      severity: "low",
      confidence: 0.55,
      evidence: dup.map(([k, v]) => ({ label: k, value: v })),
      recommendedAction: "Rodar saneamento de duplicidades em /admin/imoveis-duplicados.",
      visualization: { type: "table" },
      entity: "clients",
      limitations: ["Heurística por nome+cidade — pode trazer falsos positivos."],
    });
  }

  return out;
}

export function generateGeographicInsights(input: EngineInput): Insight[] {
  const out: Insight[] = [];
  const cities = topNCount(input.budgets, (b) => b.city, 5);
  if (cities.length >= 1) {
    out.push({
      id: id("geo-cities"),
      type: "geographic",
      title: `Concentração geográfica: ${cities[0].key} lidera (${cities[0].count})`,
      summary: `As 5 cidades principais respondem por ${cities.reduce((acc, c) => acc + c.count, 0)} orçamentos.`,
      severity: "info",
      confidence: 0.85,
      evidence: cities.map((c) => ({ label: c.key, value: c.count })),
      visualization: {
        type: "bar",
        data: cities.map((c) => ({ cidade: c.key, qtd: c.count })),
        x: "cidade",
        y: "qtd",
      },
      entity: "budgets",
      limitations: ["Inferência por campo de texto livre — pode haver variações de grafia."],
    });
  }
  return out;
}

// ─── Loss reasons ────────────────────────────────────────────────────────

export function generateLostReasonInsights(input: EngineInput): Insight[] {
  if (!input.lostReasons || input.lostReasons.length === 0) return [];
  const top = topNCount(input.lostReasons, (l) => l.reason_category, 6);
  if (top.length === 0) return [];
  const total = input.lostReasons.length;
  const competitorLosses = input.lostReasons.filter((l) => !!l.competitor_name).length;
  const lossPct = total > 0 ? competitorLosses / total : 0;
  return [
    {
      id: id("lost-categories"),
      type: "diagnostic",
      title: `Top motivos de perda: ${top[0].key} (${top[0].count})`,
      summary: `${total} perdas registradas no período — ${competitorLosses} contra concorrente identificado (${(lossPct * 100).toFixed(0)}%).`,
      severity: lossPct >= 0.5 ? "high" : "medium",
      confidence: 0.8,
      evidence: top.map((t) => ({ label: t.key, value: t.count })),
      recommendedAction: lossPct >= 0.5 ? "Mapear concorrência e reforçar diferenciais comerciais." : undefined,
      visualization: { type: "pie", data: top.map((t) => ({ motivo: t.key, qtd: t.count })) },
      entity: "budget_lost_reasons",
      metricId: "loss_to_competitor_pct",
    },
  ];
}

// ─── Orquestração ────────────────────────────────────────────────────────

const GENERATORS: Array<(input: EngineInput, n: EngineNumbers) => Insight[]> = [
  generateDescriptiveInsights,
  generateComparativeInsights,
  generateDiagnosticInsights,
  generateFunnelInsights,
  generateFinancialInsights,
  generateOperationalInsights,
  generatePredictiveInsights,
  generatePrescriptiveInsights,
  (input) => generateDataQualityInsights(input),
  (input) => generateGeographicInsights(input),
  (input) => generateLostReasonInsights(input),
];

/**
 * Roda todo o pipeline de geração de insights e retorna a lista ranqueada.
 * Use o segundo argumento opcional para filtrar por tipo (ex.: só financeiro).
 */
export function runInsightEngine(input: EngineInput, types?: InsightType[]): Insight[] {
  if (!input.budgets || input.budgets.length === 0) {
    return [{
      id: id("empty"),
      type: "data_quality",
      title: "Sem dados no período",
      summary: "Nenhum orçamento foi encontrado para o intervalo selecionado.",
      severity: "info",
      confidence: 1,
      evidence: [{ label: "Orçamentos analisados", value: 0 }],
      visualization: { type: "kpi" },
      limitations: ["Selecione um período mais amplo ou verifique filtros aplicados."],
    }];
  }
  const numbers = computeNumbers(input);
  const all: Insight[] = [];
  for (const g of GENERATORS) {
    try {
      const ins = g(input, numbers);
      all.push(...ins);
    } catch {
      // Falha em um gerador não derruba os demais.
    }
  }
  const filtered = types ? all.filter((i) => types.includes(i.type)) : all;
  return rankInsights(filtered);
}

/**
 * Versão "pergunta → análise". Quando houver `context.question`, o consumidor
 * deve passar a intenção já parseada em `types`. Quando não houver, gera
 * análise completa.
 */
export function analyze(input: EngineInput, context: AnalysisContext, types?: InsightType[]): AnalysisResult {
  const insights = runInsightEngine(input, types);
  const limitations = Array.from(new Set(insights.flatMap((i) => i.limitations ?? [])));
  const metricsUsed = Array.from(
    new Set(insights.map((i) => i.metricId).filter((m): m is string => Boolean(m && METRIC_DEFINITIONS[m]))),
  );
  const visualizations = insights
    .map((i) => i.visualization ?? { type: recommendVisualization(i.type) })
    .filter((v, idx, arr) => arr.findIndex((x) => x.type === v.type) === idx);
  const top = insights.slice(0, 5);
  const answer = top.length === 0
    ? "Sem dados suficientes para responder."
    : `Resumo: ${top.map((i) => `(${i.severity ?? "info"}) ${i.title}`).join(" · ")}`;
  const nextSteps = insights
    .map((i) => i.recommendedAction)
    .filter((s): s is string => Boolean(s))
    .slice(0, 5);
  const confidence = insights.length === 0 ? 0.4 : (mean(insights.map((i) => i.confidence)) ?? 0.5);
  return {
    answer,
    insights,
    metricsUsed,
    visualizations,
    filtersApplied: context.filters ?? {},
    confidence: Number(confidence.toFixed(2)),
    limitations,
    nextSteps,
    generatedAt: new Date().toISOString(),
  };
}

export type { ProfileRow };
