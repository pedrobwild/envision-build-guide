import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { STATUS_GROUPS } from "@/lib/role-constants";
import type { BudgetWithSections, SectionWithItems, AdjustmentRow } from "@/types/budget-common";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface KpiData {
  value: number | null;
  change: number | null;
  trend: "up" | "down" | "stable" | null;
  sparkline?: number[];
}

export type HealthStatus = "healthy" | "warning" | "critical" | null;

export interface KpiMeta {
  health: HealthStatus;
  microText: string;
  target?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  activeBudgets: number;
  completedInPeriod: number;
  avgLeadTimeDays: number | null;
  overloaded: boolean;
  overdueCount: number;
  waitingInfoCount: number;
  inReviewCount: number;
  slaRate: number;
  health: "healthy" | "warning" | "critical";
}

export interface BacklogStatus {
  status: string;
  label: string;
  count: number;
}

export interface MonthlyFinancial {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface Insight {
  type: "positive" | "negative" | "neutral";
  message: string;
}

export interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info" | "opportunity";
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  actionQuery?: Record<string, string>;
  count?: number;
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  passRate: number | null;
  drop: number;
}

export interface AgingBucket {
  label: string;
  count: number;
  color: string;
}

export interface SlaRiskItem {
  id: string;
  projectName: string;
  clientName: string;
  dueAt: string;
  hoursLeft: number;
  status: string;
}

export interface DashboardMetrics {
  received: KpiData;
  backlog: KpiData;
  slaOnTime: KpiData;
  overdue: KpiData;
  avgLeadTime: KpiData;
  conversionRate: KpiData;
  portfolioValue: KpiData;
  grossMargin: KpiData;
  kpiMeta: {
    received: KpiMeta;
    backlog: KpiMeta;
    slaOnTime: KpiMeta;
    overdue: KpiMeta;
    avgLeadTime: KpiMeta;
    conversionRate: KpiMeta;
    portfolioValue: KpiMeta;
    grossMargin: KpiMeta;
  };
  revenue: number;
  revenueChange: number | null;
  avgTicket: number | null;
  closedCount: number;
  backlogByStatus: BacklogStatus[];
  monthlyFinancials: MonthlyFinancial[];
  teamMetrics: TeamMember[];
  insights: Insight[];
  alerts: AlertItem[];
  operationalFunnel: FunnelStage[];
  commercialFunnel: FunnelStage[];
  agingBuckets: AgingBucket[];
  slaRiskItems: SlaRiskItem[];
  stalledByStage: { stage: string; label: string; count: number; avgDays: number }[];
}

const ACTIVE_STATUSES: readonly string[] = STATUS_GROUPS.OPERATIONS_ACTIVE;

const STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  novo: "Novo",
  triage: "Triagem",
  assigned: "Atribuído",
  in_progress: "Em elaboração",
  waiting_info: "Aguardando",
  blocked: "Bloqueado",
  ready_for_review: "Pronto p/ revisão",
  delivered_to_sales: "Entregue ao comercial",
  sent_to_client: "Enviado ao cliente",
  revision_requested: "Revisão solicitada",
  minuta_solicitada: "Minuta solicitada",
  contrato_fechado: "Contrato fechado",
  lost: "Perdido",
  archived: "Arquivado",
};

function getPreviousPeriod(range: DateRange): DateRange {
  const duration = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - duration),
    to: new Date(range.from.getTime()),
  };
}

function makeKpi(current: number | null, previous: number | null): KpiData {
  if (current === null) return { value: null, change: null, trend: null };
  if (previous === null || previous === undefined) {
    return { value: current, change: null, trend: null };
  }
  const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : current > 0 ? 100 : 0;
  const trend = current > previous ? "up" : current < previous ? "down" : "stable";
  return { value: current, change: Math.round(change * 10) / 10, trend };
}

function isInRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= range.from && d <= range.to;
}

function getBudgetTotal(b: BudgetWithSections): number {
  const sectionsTotal = (b.sections || []).reduce(
    (sum: number, s: SectionWithItems) => sum + calculateSectionSubtotal(s),
    0
  );
  const adjustmentsTotal = (b.adjustments || []).reduce(
    (sum: number, adj: AdjustmentRow) => sum + adj.sign * Number(adj.amount),
    0
  );
  return sectionsTotal + adjustmentsTotal;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)));
}

function hoursUntil(dateStr: string): number {
  return (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function computeDashboardMetrics(
  budgets: BudgetWithSections[],
  range: DateRange,
  profiles: Record<string, string>,
): DashboardMetrics {
  const prev = getPreviousPeriod(range);
  const now = new Date();

  // Dev warning for inconsistent status fields
  if (process.env.NODE_ENV === 'development') {
    const inconsistent = budgets.filter(b => b.internal_status === 'contrato_fechado' && b.status !== 'published');
    if (inconsistent.length > 0) {
      console.warn(`[Metrics] ${inconsistent.length} budgets with inconsistent status/internal_status`);
    }
  }

  // ─── Received ───
  const receivedCurrent = budgets.filter((b) => isInRange(b.created_at, range)).length;
  const receivedPrev = budgets.filter((b) => isInRange(b.created_at, prev)).length;

  // ─── Backlog ───
  const backlogBudgets = budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status));
  const backlogCount = backlogBudgets.length;
  const prevBacklogSnapshot = budgets.filter((b) => {
    if (!ACTIVE_STATUSES.includes(b.internal_status)) return false;
    return b.created_at && new Date(b.created_at) < range.from;
  }).length;

  // ─── SLA & Overdue ───
  const withDueDate = backlogBudgets.filter((b) => b.due_at);
  const overdueList = withDueDate.filter((b) => new Date(b.due_at!) < now);
  const sla = backlogBudgets.length > 0
    ? ((backlogBudgets.length - overdueList.length) / backlogBudgets.length) * 100
    : 100;

  // ─── SLA Risk (next 24h/48h) ───
  const slaRiskItems: SlaRiskItem[] = backlogBudgets
    .filter((b) => b.due_at)
    .filter((b) => {
      const h = hoursUntil(b.due_at!);
      return h > 0 && h <= 48;
    })
    .map((b) => ({
      id: b.id,
      projectName: b.project_name,
      clientName: b.client_name,
      dueAt: b.due_at!,
      hoursLeft: Math.round(hoursUntil(b.due_at!)),
      status: b.internal_status,
    }))
    .sort((a, b) => a.hoursLeft - b.hoursLeft);

  // ─── Lead Time ───
  const DELIVERED_STATUSES = ["sent_to_client", "minuta_solicitada", "contrato_fechado"];
  const deliveredInPeriod = budgets.filter((b) => {
    const deliveredDate = b.generated_at || b.closed_at;
    return deliveredDate && isInRange(deliveredDate, range) && DELIVERED_STATUSES.includes(b.internal_status);
  });
  const calcLeadTimes = (list: BudgetWithSections[]) =>
    list
      .map((b) => {
        const start = new Date(b.created_at!).getTime();
        const end = new Date((b.generated_at || b.closed_at)!).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      })
      .filter((lt) => lt > 0 && lt < 365);
  const leadTimes = calcLeadTimes(deliveredInPeriod);
  const avgLT = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  const deliveredInPrev = budgets.filter((b) => {
    const deliveredDate = b.generated_at || b.closed_at;
    return deliveredDate && isInRange(deliveredDate, prev) && DELIVERED_STATUSES.includes(b.internal_status);
  });
  const prevLeadTimes = calcLeadTimes(deliveredInPrev);
  const prevAvgLT = prevLeadTimes.length > 0 ? prevLeadTimes.reduce((a, b) => a + b, 0) / prevLeadTimes.length : null;

  // ─── Conversion ───
  const publishedInPeriod = budgets.filter((b) => {
    const d = b.generated_at || b.updated_at;
    return d && isInRange(d, range) && DELIVERED_STATUSES.includes(b.internal_status);
  });
  const closedInPeriod = budgets.filter((b) =>
    b.internal_status === "contrato_fechado" && isInRange(b.closed_at || b.updated_at, range)
  );
  const conversion = publishedInPeriod.length > 0
    ? (closedInPeriod.length / publishedInPeriod.length) * 100
    : null;

  const prevPublished = budgets.filter((b) => {
    const d = b.generated_at || b.updated_at;
    return d && isInRange(d, prev) && DELIVERED_STATUSES.includes(b.internal_status);
  });
  const prevClosed = budgets.filter((b) =>
    b.internal_status === "contrato_fechado" && isInRange(b.closed_at || b.updated_at, prev)
  );
  const prevConversion = prevPublished.length > 0
    ? (prevClosed.length / prevPublished.length) * 100
    : null;

  // ─── Portfolio Value ───
  const portfolio = backlogBudgets.reduce((sum, b) => sum + getBudgetTotal(b), 0);

  // ─── Margin ───
  const periodRevenue = closedInPeriod.reduce((sum, b) => sum + getBudgetTotal(b), 0);
  const periodCost = closedInPeriod.reduce((sum, b) => sum + (Number(b.internal_cost) || 0), 0);
  const margin = periodRevenue > 0 ? ((periodRevenue - periodCost) / periodRevenue) * 100 : null;

  const prevRevenue = prevClosed.reduce((sum, b) => sum + getBudgetTotal(b), 0);
  const prevCost = prevClosed.reduce((sum, b) => sum + (Number(b.internal_cost) || 0), 0);
  const prevMargin = prevRevenue > 0 ? ((prevRevenue - prevCost) / prevRevenue) * 100 : null;

  // ─── Backlog by Status ───
  const backlogByStatus: BacklogStatus[] = ACTIVE_STATUSES
    .map((s) => ({
      status: s,
      label: STATUS_LABELS[s] || s,
      count: backlogBudgets.filter((b) => b.internal_status === s).length,
    }))
    .filter((s) => s.count > 0);

  // ─── Monthly Financials (last 6 months) ───
  const monthlyMap = new Map<string, { revenue: number; cost: number }>();
  budgets
    .filter((b) => b.internal_status === "contrato_fechado" && b.closed_at)
    .forEach((b) => {
      const d = new Date(b.closed_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) || { revenue: 0, cost: 0 };
      existing.revenue += getBudgetTotal(b);
      existing.cost += Number(b.internal_cost) || 0;
      monthlyMap.set(key, existing);
    });
  const monthlyFinancials: MonthlyFinancial[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, data]) => ({
      month: new Date(month + "-15").toLocaleDateString("pt-BR", { month: "short" }),
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
    }));

  // ─── Team Metrics ───
  const estimatorIds = [...new Set(budgets.map((b) => b.estimator_owner_id).filter(Boolean))] as string[];
  const teamMetrics: TeamMember[] = estimatorIds
    .map((id) => {
      const memberBacklog = backlogBudgets.filter((b) => b.estimator_owner_id === id);
      const active = memberBacklog.length;
      const completed = deliveredInPeriod.filter((b) => b.estimator_owner_id === id).length;
      const memberLTs = calcLeadTimes(
        deliveredInPeriod.filter((b) => b.estimator_owner_id === id)
      );
      const overdueCount = memberBacklog.filter((b) => b.due_at && new Date(b.due_at) < now).length;
      const waitingInfoCount = memberBacklog.filter((b) => b.internal_status === "waiting_info").length;
      const inReviewCount = memberBacklog.filter((b) => b.internal_status === "ready_for_review").length;
      const slaRate = active > 0 ? Math.round(((active - overdueCount) / active) * 100) : 100;
      const isOverloaded = active >= 5;
      const health: "healthy" | "warning" | "critical" =
        overdueCount >= 3 || (isOverloaded && overdueCount > 0) ? "critical"
        : isOverloaded || overdueCount > 0 || waitingInfoCount >= 2 ? "warning"
        : "healthy";
      return {
        id,
        name: profiles[id] || "Sem nome",
        activeBudgets: active,
        completedInPeriod: completed,
        avgLeadTimeDays: memberLTs.length > 0
          ? Math.round((memberLTs.reduce((a, b) => a + b, 0) / memberLTs.length) * 10) / 10
          : null,
        overloaded: isOverloaded,
        overdueCount,
        waitingInfoCount,
        inReviewCount,
        slaRate,
        health,
      };
    })
    .sort((a, b) => {
      const hOrder = { critical: 0, warning: 1, healthy: 2 };
      if (hOrder[a.health] !== hOrder[b.health]) return hOrder[a.health] - hOrder[b.health];
      return b.activeBudgets - a.activeBudgets;
    });

  // ─── KPI Health Metadata ───
  const kpiMeta: DashboardMetrics["kpiMeta"] = {
    received: {
      health: receivedCurrent > receivedPrev * 1.5 ? "warning" : "healthy",
      microText: receivedPrev > 0
        ? `${receivedPrev} no período anterior`
        : "Sem dados do período anterior",
      target: undefined,
    },
    backlog: {
      health: backlogCount > 15 ? "critical" : backlogCount > 8 ? "warning" : "healthy",
      microText: backlogCount > 8
        ? "Acima da capacidade ideal da equipe"
        : "Dentro da capacidade operacional",
      target: "≤ 8 itens",
    },
    slaOnTime: {
      health: sla < 60 ? "critical" : sla < 80 ? "warning" : "healthy",
      microText: `${backlogBudgets.length - overdueList.length} de ${backlogBudgets.length} no prazo`,
      target: "≥ 80%",
    },
    overdue: {
      health: overdueList.length > 3 ? "critical" : overdueList.length > 0 ? "warning" : "healthy",
      microText: overdueList.length > 0
        ? `${overdueList.length} item${overdueList.length > 1 ? "ns" : ""} com prazo vencido`
        : "Nenhum item vencido",
    },
    avgLeadTime: {
      health: avgLT !== null && avgLT > 14 ? "critical" : avgLT !== null && avgLT > 7 ? "warning" : "healthy",
      microText: avgLT !== null
        ? `Baseado em ${leadTimes.length} entrega${leadTimes.length > 1 ? "s" : ""} no período`
        : "Sem entregas no período",
      target: "≤ 7 dias",
    },
    conversionRate: {
      health: conversion !== null && conversion < 15 ? "critical" : conversion !== null && conversion < 30 ? "warning" : "healthy",
      microText: `${closedInPeriod.length} fechado${closedInPeriod.length !== 1 ? "s" : ""} de ${publishedInPeriod.length} enviado${publishedInPeriod.length !== 1 ? "s" : ""}`,
      target: "≥ 30%",
    },
    portfolioValue: {
      health: "healthy",
      microText: `${backlogCount} orçamentos ativos em carteira`,
    },
    grossMargin: {
      health: margin !== null && margin < 10 ? "critical" : margin !== null && margin < 20 ? "warning" : "healthy",
      microText: margin !== null
        ? `Receita: R$ ${(periodRevenue / 1000).toFixed(0)}k | Custo: R$ ${(periodCost / 1000).toFixed(0)}k`
        : "Sem contratos fechados no período",
      target: "≥ 20%",
    },
  };

  // ─── Alerts ───
  const alerts: AlertItem[] = [];

  if (overdueList.length > 0) {
    alerts.push({
      id: "overdue",
      severity: "critical",
      title: `${overdueList.length} orçamento${overdueList.length > 1 ? "s" : ""} vencido${overdueList.length > 1 ? "s" : ""}`,
      description: "Itens com prazo de entrega ultrapassado exigem ação imediata.",
      actionLabel: "Ver atrasados",
      actionPath: "/admin/operacoes",
      actionQuery: { filter: "overdue" },
      count: overdueList.length,
    });
  }

  if (slaRiskItems.length > 0) {
    const in24h = slaRiskItems.filter((r) => r.hoursLeft <= 24).length;
    alerts.push({
      id: "sla-risk",
      severity: in24h > 0 ? "critical" : "warning",
      title: `${slaRiskItems.length} item${slaRiskItems.length > 1 ? "ns" : ""} em risco de SLA`,
      description: in24h > 0
        ? `${in24h} vence${in24h > 1 ? "m" : ""} nas próximas 24h.`
        : "Vencimento previsto nas próximas 48h.",
      actionLabel: "Ver em risco",
      actionPath: "/admin/operacoes",
      actionQuery: { filter: "sla_risk" },
      count: slaRiskItems.length,
    });
  }

  if (sla < 70 && backlogBudgets.length > 0) {
    alerts.push({
      id: "sla-low",
      severity: "critical",
      title: `SLA abaixo da meta: ${sla.toFixed(0)}%`,
      description: "A operação está entregando fora do prazo. Rever priorização e capacidade.",
      actionLabel: "Ver backlog",
      actionPath: "/admin/operacoes",
    });
  }

  const waitingInfo = backlogBudgets.filter((b) => b.internal_status === "waiting_info");
  if (waitingInfo.length >= 3) {
    const avgWaitDays = Math.round(waitingInfo.reduce((sum, b) => sum + daysSince(b.updated_at), 0) / waitingInfo.length);
    alerts.push({
      id: "waiting-bottleneck",
      severity: "warning",
      title: `${waitingInfo.length} itens aguardando informação`,
      description: `Média de ${avgWaitDays} dia${avgWaitDays !== 1 ? "s" : ""} parados. Possível gargalo de comunicação.`,
      actionLabel: "Ver aguardando",
      actionPath: "/admin/operacoes",
      actionQuery: { status: "waiting_info" },
      count: waitingInfo.length,
    });
  }

  const reviewItems = backlogBudgets.filter((b) => b.internal_status === "ready_for_review");
  if (reviewItems.length >= 2) {
    alerts.push({
      id: "review-queue",
      severity: "warning",
      title: `${reviewItems.length} orçamentos na fila de revisão`,
      description: "Revisões pendentes podem atrasar entregas ao comercial.",
      actionLabel: "Ver revisão",
      actionPath: "/admin/operacoes",
      actionQuery: { status: "ready_for_review" },
      count: reviewItems.length,
    });
  }

  if (margin !== null && margin < 15 && margin > 0) {
    alerts.push({
      id: "margin-low",
      severity: "warning",
      title: `Margem bruta abaixo do esperado: ${margin.toFixed(1)}%`,
      description: "Revisar precificação e custos dos últimos contratos.",
      actionLabel: "Ver financeiro",
      actionPath: "/admin/financeiro",
    });
  }

  const overloadedMembers = teamMetrics.filter((m) => m.overloaded);
  if (overloadedMembers.length > 0) {
    alerts.push({
      id: "overload",
      severity: "warning",
      title: `${overloadedMembers.length} orçamentista${overloadedMembers.length > 1 ? "s" : ""} sobrecarregado${overloadedMembers.length > 1 ? "s" : ""}`,
      description: overloadedMembers.map((m) => `${m.name} (${m.activeBudgets})`).join(", "),
      actionLabel: "Ver equipe",
      actionPath: "/admin/operacoes",
    });
  }

  if (backlogCount > 10) {
    alerts.push({
      id: "backlog-high",
      severity: "warning",
      title: `Backlog elevado: ${backlogCount} itens`,
      description: "Volume acima do ideal. Considere redistribuir carga ou priorizar entregas.",
      actionLabel: "Ver backlog",
      actionPath: "/admin/operacoes",
    });
  }

  if (conversion !== null && conversion > 40) {
    alerts.push({
      id: "conversion-high",
      severity: "info",
      title: `Conversão elevada: ${conversion.toFixed(0)}%`,
      description: "Excelente taxa de fechamento no período.",
    });
  }

  if (closedInPeriod.length > prevClosed.length && prevClosed.length > 0) {
    alerts.push({
      id: "contracts-up",
      severity: "info",
      title: `Contratos cresceram ${closedInPeriod.length - prevClosed.length} vs anterior`,
      description: `${closedInPeriod.length} fechados no período atual vs ${prevClosed.length} no anterior.`,
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2, opportunity: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // ─── Operational Funnel ───
  const opStages = [
    { key: "received", label: "Recebido", statuses: ["requested", "novo"] },
    { key: "triage", label: "Triagem", statuses: ["triage"] },
    { key: "assigned", label: "Atribuído", statuses: ["assigned"] },
    { key: "in_progress", label: "Em elaboração", statuses: ["in_progress", "waiting_info", "blocked"] },
    { key: "review", label: "Revisão", statuses: ["ready_for_review"] },
    { key: "delivered", label: "Entregue", statuses: ["delivered_to_sales"] },
  ];

  const opCounts = opStages.map((s) => {
    const count = budgets.filter((b) =>
      s.statuses.includes(b.internal_status) &&
      (isInRange(b.created_at, range) || ACTIVE_STATUSES.includes(b.internal_status))
    ).length;
    return count;
  });

  const operationalFunnel: FunnelStage[] = opStages.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: opCounts[i],
    passRate: i > 0 && opCounts[i - 1] > 0 ? Math.round((opCounts[i] / opCounts[i - 1]) * 100) : null,
    drop: i > 0 ? Math.max(0, opCounts[i - 1] - opCounts[i]) : 0,
  }));

  // ─── Commercial Funnel ───
  interface ComStage {
    key: string;
    label: string;
    statuses?: string[];
    filter?: (b: BudgetWithSections) => boolean;
  }

  const comStages: ComStage[] = [
    { key: "sent", label: "Enviado", statuses: ["sent_to_client"] },
    { key: "viewed", label: "Visualizado", filter: (b) => b.internal_status === "sent_to_client" && b.view_count > 0 },
    { key: "negotiation", label: "Em negociação", statuses: ["minuta_solicitada", "revision_requested"] },
    { key: "closed", label: "Contrato fechado", statuses: ["contrato_fechado"] },
  ];

  const comCounts = comStages.map((s) => {
    if (s.filter) {
      return budgets.filter(s.filter).length;
    }
    return budgets.filter((b) => s.statuses!.includes(b.internal_status)).length;
  });

  const commercialFunnel: FunnelStage[] = comStages.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: comCounts[i],
    passRate: i > 0 && comCounts[i - 1] > 0 ? Math.round((comCounts[i] / comCounts[i - 1]) * 100) : null,
    drop: i > 0 ? Math.max(0, comCounts[i - 1] - comCounts[i]) : 0,
  }));

  // ─── Aging Buckets ───
  const agingBuckets: AgingBucket[] = [
    { label: "< 3 dias", count: 0, color: "hsl(var(--primary))" },
    { label: "3–7 dias", count: 0, color: "hsl(142 71% 45%)" },
    { label: "7–14 dias", count: 0, color: "hsl(38 92% 50%)" },
    { label: "14–30 dias", count: 0, color: "hsl(25 95% 53%)" },
    { label: "> 30 dias", count: 0, color: "hsl(0 84% 60%)" },
  ];

  backlogBudgets.forEach((b) => {
    const age = daysSince(b.created_at);
    if (age < 3) agingBuckets[0].count++;
    else if (age < 7) agingBuckets[1].count++;
    else if (age < 14) agingBuckets[2].count++;
    else if (age < 30) agingBuckets[3].count++;
    else agingBuckets[4].count++;
  });

  // ─── Stalled by Stage ───
  const stalledStages = ["waiting_info", "ready_for_review"];
  const stalledByStage = stalledStages.map((status) => {
    const items = backlogBudgets.filter((b) => b.internal_status === status);
    const avgDays = items.length > 0
      ? Math.round(items.reduce((sum, b) => sum + daysSince(b.updated_at), 0) / items.length)
      : 0;
    return { stage: status, label: STATUS_LABELS[status] || status, count: items.length, avgDays };
  }).filter((s) => s.count > 0);

  // ─── Insights ───
  const insights: Insight[] = [];
  if (receivedCurrent > receivedPrev && receivedPrev > 0) {
    const pct = Math.round(((receivedCurrent - receivedPrev) / receivedPrev) * 100);
    insights.push({ type: "neutral", message: `Demanda aumentou ${pct}% em relação ao período anterior` });
  } else if (receivedCurrent < receivedPrev && receivedPrev > 0) {
    const pct = Math.round(((receivedPrev - receivedCurrent) / receivedPrev) * 100);
    insights.push({ type: "neutral", message: `Demanda reduziu ${pct}% em relação ao período anterior` });
  }
  if (overdueList.length > 0) {
    insights.push({ type: "negative", message: `${overdueList.length} orçamento${overdueList.length > 1 ? "s" : ""} com prazo vencido` });
  }
  if (margin !== null && margin > 30) {
    insights.push({ type: "positive", message: `Margem bruta saudável: ${margin.toFixed(1)}%` });
  } else if (margin !== null && margin < 15 && margin > 0) {
    insights.push({ type: "negative", message: `Margem bruta abaixo do esperado: ${margin.toFixed(1)}%` });
  }
  if (backlogCount > 10) {
    insights.push({ type: "negative", message: `Backlog elevado com ${backlogCount} itens em andamento` });
  }
  if (teamMetrics.length > 0) {
    const maxLoad = teamMetrics.reduce((max, m) => (m.activeBudgets > max.activeBudgets ? m : max), teamMetrics[0]);
    if (maxLoad.activeBudgets >= 4) {
      insights.push({ type: "neutral", message: `${maxLoad.name} está com maior carga ativa (${maxLoad.activeBudgets} orçamentos)` });
    }
  }
  if (sla < 70 && backlogBudgets.length > 0) {
    insights.push({ type: "negative", message: `SLA abaixo do esperado: apenas ${sla.toFixed(0)}% no prazo` });
  } else if (sla >= 90 && backlogBudgets.length > 0) {
    insights.push({ type: "positive", message: "Performance saudável — SLA acima de 90%" });
  }
  if (insights.length === 0) {
    insights.push({ type: "positive", message: "Operação dentro dos padrões esperados no período" });
  }

  // ─── Weekly Sparklines (last 8 weeks) ───
  const WEEKS = 8;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const sparkEnd = range.to;

  function weeklyCount(filter: (b: BudgetWithSections, weekFrom: Date, weekTo: Date) => boolean): number[] {
    const counts: number[] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const wTo = new Date(sparkEnd.getTime() - w * weekMs);
      const wFrom = new Date(wTo.getTime() - weekMs);
      counts.push(budgets.filter((b) => filter(b, wFrom, wTo)).length);
    }
    return counts;
  }

  const sparkReceived = weeklyCount((b, wFrom, wTo) => {
    if (!b.created_at) return false;
    const d = new Date(b.created_at);
    return d >= wFrom && d < wTo;
  });

  const sparkClosed = weeklyCount((b, wFrom, wTo) => {
    const d = b.closed_at || b.updated_at;
    return d != null && b.internal_status === "contrato_fechado" && new Date(d) >= wFrom && new Date(d) < wTo;
  });

  const sparkDelivered = weeklyCount((b, wFrom, wTo) => {
    const d = b.generated_at || b.closed_at;
    return d != null && DELIVERED_STATUSES.includes(b.internal_status) && new Date(d) >= wFrom && new Date(d) < wTo;
  });

  const sparkBacklog = (() => {
    const counts: number[] = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const wTo = new Date(sparkEnd.getTime() - w * weekMs);
      counts.push(budgets.filter((b) =>
        ACTIVE_STATUSES.includes(b.internal_status) && b.created_at && new Date(b.created_at) <= wTo
      ).length);
    }
    return counts;
  })();

  const sparkOverdue = weeklyCount((b, wFrom, wTo) => {
    return ACTIVE_STATUSES.includes(b.internal_status) && b.due_at != null && new Date(b.due_at) < wTo && new Date(b.due_at) >= wFrom;
  });

  return {
    received: { ...makeKpi(receivedCurrent, receivedPrev), sparkline: sparkReceived },
    backlog: { ...makeKpi(backlogCount, prevBacklogSnapshot > 0 ? prevBacklogSnapshot : null), sparkline: sparkBacklog },
    slaOnTime: { value: Math.round(sla * 10) / 10, change: null, trend: sla >= 80 ? "up" : sla < 60 ? "down" : "stable" },
    overdue: { value: overdueList.length, change: null, trend: overdueList.length === 0 ? "up" : "down", sparkline: sparkOverdue },
    avgLeadTime: makeKpi(avgLT !== null ? Math.round(avgLT * 10) / 10 : null, prevAvgLT !== null ? Math.round(prevAvgLT * 10) / 10 : null),
    conversionRate: { ...makeKpi(conversion !== null ? Math.round(conversion * 10) / 10 : null, prevConversion !== null ? Math.round(prevConversion * 10) / 10 : null), sparkline: sparkClosed },
    portfolioValue: { value: portfolio, change: null, trend: null },
    grossMargin: { ...makeKpi(margin !== null ? Math.round(margin * 10) / 10 : null, prevMargin !== null ? Math.round(prevMargin * 10) / 10 : null), sparkline: sparkDelivered },
    kpiMeta,
    revenue: periodRevenue,
    revenueChange: prevRevenue > 0 ? Math.round(((periodRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10 : null,
    avgTicket: closedInPeriod.length > 0 ? periodRevenue / closedInPeriod.length : null,
    closedCount: closedInPeriod.length,
    backlogByStatus,
    monthlyFinancials,
    teamMetrics,
    insights,
    alerts,
    operationalFunnel,
    commercialFunnel,
    agingBuckets,
    slaRiskItems,
    stalledByStage,
  };
}
