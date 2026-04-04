import { calculateSectionSubtotal } from "@/lib/supabase-helpers";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface KpiData {
  value: number | null;
  change: number | null;
  trend: "up" | "down" | "stable" | null;
}

export interface TeamMember {
  id: string;
  name: string;
  activeBudgets: number;
  completedInPeriod: number;
  avgLeadTimeDays: number | null;
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

export interface DashboardMetrics {
  received: KpiData;
  backlog: KpiData;
  slaOnTime: KpiData;
  overdue: KpiData;
  avgLeadTime: KpiData;
  conversionRate: KpiData;
  portfolioValue: KpiData;
  grossMargin: KpiData;
  revenue: number;
  revenueChange: number | null;
  avgTicket: number | null;
  closedCount: number;
  backlogByStatus: BacklogStatus[];
  monthlyFinancials: MonthlyFinancial[];
  teamMetrics: TeamMember[];
  insights: Insight[];
}

const ACTIVE_STATUSES = [
  "requested", "novo", "triage", "assigned",
  "in_progress", "waiting_info", "blocked", "ready_for_review",
];

const STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  novo: "Novo",
  triage: "Triagem",
  assigned: "Atribuído",
  in_progress: "Em elaboração",
  waiting_info: "Aguardando info",
  blocked: "Bloqueado",
  ready_for_review: "Pronto p/ revisão",
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

function getBudgetTotal(b: any): number {
  const sectionsTotal = (b.sections || []).reduce(
    (sum: number, s: any) => sum + calculateSectionSubtotal(s),
    0
  );
  const adjustmentsTotal = (b.adjustments || []).reduce(
    (sum: number, adj: any) => sum + adj.sign * Number(adj.amount),
    0
  );
  return sectionsTotal + adjustmentsTotal;
}

export function computeDashboardMetrics(
  budgets: any[],
  range: DateRange,
  profiles: Record<string, string>,
): DashboardMetrics {
  const prev = getPreviousPeriod(range);
  const now = new Date();

  // Received
  const receivedCurrent = budgets.filter((b) => isInRange(b.created_at, range)).length;
  const receivedPrev = budgets.filter((b) => isInRange(b.created_at, prev)).length;

  // Backlog
  const backlogBudgets = budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status));
  const backlogCount = backlogBudgets.length;

  // SLA & Overdue
  const withDueDate = backlogBudgets.filter((b) => b.due_at);
  const onTime = withDueDate.filter((b) => new Date(b.due_at) >= now);
  const overdueList = withDueDate.filter((b) => new Date(b.due_at) < now);
  // Include budgets without due_at as "on time" for SLA calc
  const sla = backlogBudgets.length > 0
    ? ((backlogBudgets.length - overdueList.length) / backlogBudgets.length) * 100
    : 100;

  // Lead Time — delivered/published in period
  const DELIVERED_STATUSES = ["published", "contrato_fechado", "minuta_solicitada"];
  const deliveredInPeriod = budgets.filter((b) => {
    const deliveredDate = b.generated_at || b.closed_at;
    return deliveredDate && isInRange(deliveredDate, range) && DELIVERED_STATUSES.includes(b.status);
  });
  const calcLeadTimes = (list: any[]) =>
    list
      .map((b) => {
        const start = new Date(b.created_at).getTime();
        const end = new Date(b.generated_at || b.closed_at).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      })
      .filter((lt) => lt > 0 && lt < 365);
  const leadTimes = calcLeadTimes(deliveredInPeriod);
  const avgLT = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  const deliveredInPrev = budgets.filter((b) => {
    const deliveredDate = b.generated_at || b.closed_at;
    return deliveredDate && isInRange(deliveredDate, prev) && DELIVERED_STATUSES.includes(b.status);
  });
  const prevLeadTimes = calcLeadTimes(deliveredInPrev);
  const prevAvgLT = prevLeadTimes.length > 0 ? prevLeadTimes.reduce((a, b) => a + b, 0) / prevLeadTimes.length : null;

  // Conversion
  const publishedInPeriod = budgets.filter((b) => {
    const d = b.generated_at || b.updated_at;
    return d && isInRange(d, range) && DELIVERED_STATUSES.includes(b.status);
  });
  const closedInPeriod = budgets.filter((b) =>
    b.status === "contrato_fechado" && isInRange(b.closed_at || b.updated_at, range)
  );
  const conversion = publishedInPeriod.length > 0
    ? (closedInPeriod.length / publishedInPeriod.length) * 100
    : null;

  const prevPublished = budgets.filter((b) => {
    const d = b.generated_at || b.updated_at;
    return d && isInRange(d, prev) && DELIVERED_STATUSES.includes(b.status);
  });
  const prevClosed = budgets.filter((b) =>
    b.status === "contrato_fechado" && isInRange(b.closed_at || b.updated_at, prev)
  );
  const prevConversion = prevPublished.length > 0
    ? (prevClosed.length / prevPublished.length) * 100
    : null;

  // Portfolio Value
  const portfolio = backlogBudgets.reduce((sum, b) => sum + getBudgetTotal(b), 0);

  // Margin
  const periodRevenue = closedInPeriod.reduce((sum, b) => sum + getBudgetTotal(b), 0);
  const periodCost = closedInPeriod.reduce((sum, b) => sum + (Number(b.internal_cost) || 0), 0);
  const margin = periodRevenue > 0 ? ((periodRevenue - periodCost) / periodRevenue) * 100 : null;

  const prevRevenue = prevClosed.reduce((sum, b) => sum + getBudgetTotal(b), 0);
  const prevCost = prevClosed.reduce((sum, b) => sum + (Number(b.internal_cost) || 0), 0);
  const prevMargin = prevRevenue > 0 ? ((prevRevenue - prevCost) / prevRevenue) * 100 : null;

  // Backlog by Status
  const backlogByStatus: BacklogStatus[] = ACTIVE_STATUSES
    .map((s) => ({
      status: s,
      label: STATUS_LABELS[s] || s,
      count: backlogBudgets.filter((b) => b.internal_status === s).length,
    }))
    .filter((s) => s.count > 0);

  // Monthly Financials (last 6 months)
  const monthlyMap = new Map<string, { revenue: number; cost: number }>();
  budgets
    .filter((b) => b.status === "contrato_fechado" && b.closed_at)
    .forEach((b) => {
      const d = new Date(b.closed_at);
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

  // Team Metrics
  const estimatorIds = [...new Set(budgets.map((b) => b.estimator_owner_id).filter(Boolean))];
  const teamMetrics: TeamMember[] = estimatorIds
    .map((id) => {
      const active = backlogBudgets.filter((b) => b.estimator_owner_id === id).length;
      const completed = deliveredInPeriod.filter((b) => b.estimator_owner_id === id).length;
      const memberLTs = calcLeadTimes(
        deliveredInPeriod.filter((b) => b.estimator_owner_id === id)
      );
      return {
        id,
        name: profiles[id] || "Sem nome",
        activeBudgets: active,
        completedInPeriod: completed,
        avgLeadTimeDays: memberLTs.length > 0
          ? Math.round((memberLTs.reduce((a, b) => a + b, 0) / memberLTs.length) * 10) / 10
          : null,
      };
    })
    .sort((a, b) => b.completedInPeriod - a.completedInPeriod);

  // Insights
  const insights: Insight[] = [];
  if (receivedCurrent > receivedPrev && receivedPrev > 0) {
    const pct = Math.round(((receivedCurrent - receivedPrev) / receivedPrev) * 100);
    insights.push({
      type: "neutral",
      message: `Demanda aumentou ${pct}% em relação ao período anterior`,
    });
  } else if (receivedCurrent < receivedPrev && receivedPrev > 0) {
    const pct = Math.round(((receivedPrev - receivedCurrent) / receivedPrev) * 100);
    insights.push({
      type: "neutral",
      message: `Demanda reduziu ${pct}% em relação ao período anterior`,
    });
  }
  if (overdueList.length > 0) {
    insights.push({
      type: "negative",
      message: `${overdueList.length} orçamento${overdueList.length > 1 ? "s" : ""} com prazo vencido`,
    });
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
      insights.push({
        type: "neutral",
        message: `${maxLoad.name} está com maior carga ativa (${maxLoad.activeBudgets} orçamentos)`,
      });
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

  return {
    received: makeKpi(receivedCurrent, receivedPrev),
    backlog: { value: backlogCount, change: null, trend: null },
    slaOnTime: { value: Math.round(sla * 10) / 10, change: null, trend: sla >= 80 ? "up" : sla < 60 ? "down" : "stable" },
    overdue: { value: overdueList.length, change: null, trend: overdueList.length === 0 ? "up" : "down" },
    avgLeadTime: makeKpi(avgLT !== null ? Math.round(avgLT * 10) / 10 : null, prevAvgLT !== null ? Math.round(prevAvgLT * 10) / 10 : null),
    conversionRate: makeKpi(conversion !== null ? Math.round(conversion * 10) / 10 : null, prevConversion !== null ? Math.round(prevConversion * 10) / 10 : null),
    portfolioValue: { value: portfolio, change: null, trend: null },
    grossMargin: makeKpi(margin !== null ? Math.round(margin * 10) / 10 : null, prevMargin !== null ? Math.round(prevMargin * 10) / 10 : null),
    revenue: periodRevenue,
    revenueChange: prevRevenue > 0 ? Math.round(((periodRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10 : null,
    avgTicket: closedInPeriod.length > 0 ? periodRevenue / closedInPeriod.length : null,
    closedCount: closedInPeriod.length,
    backlogByStatus,
    monthlyFinancials,
    teamMetrics,
    insights,
  };
}
