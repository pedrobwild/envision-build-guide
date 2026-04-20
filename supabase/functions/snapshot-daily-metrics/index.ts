// Edge function: snapshot-daily-metrics
// Gera ou atualiza a fotografia diária de KPIs operacionais.
// Chamado por cron job (1x/dia) ou manualmente por admins via dashboard.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPERATIONS_START = "2026-04-15T00:00:00Z";

const ACTIVE_STATUSES = [
  "novo", "em_analise", "aguardando_info", "em_revisao",
  "delivered_to_sales", "published", "minuta_solicitada",
];
const CLOSED_STATUSES = ["contrato_fechado", "perdido"];

interface BudgetRow {
  id: string;
  internal_status: string;
  created_at: string;
  due_at: string | null;
  closed_at: string | null;
  manual_total: number | null;
  internal_cost: number | null;
  estimator_owner_id: string | null;
  commercial_owner_id: string | null;
}

interface SectionRow { budget_id: string; section_price: number | null; }
interface ItemRow { section_id: string; internal_total: number | null; }

async function sb(path: string, init?: RequestInit, timeoutMs = 30000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Supabase ${path} → ${res.status}: ${t}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Converte uma data YYYY-MM-DD (interpretada em America/Sao_Paulo, UTC-3 fixo
// pois o BR não tem mais DST desde 2019) para os instantes UTC equivalentes
// ao início e fim do dia local. Isso evita que orçamentos criados entre
// 21h-00h UTC (18h-21h BRT) caiam no dia errado.
function brtDayBoundsUtc(snapshotDate: string): { start: Date; end: Date } {
  // BRT = UTC-3 → meia-noite local = 03:00 UTC do mesmo dia
  const start = new Date(`${snapshotDate}T03:00:00Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function calcHealthScore(kpis: {
  slaPct: number | null; leadTime: number | null; conversion: number | null;
  margin: number | null; backlog: number; received: number;
}): { score: number; diagnosis: "excellent" | "healthy" | "warning" | "critical" } {
  const slaScore = kpis.slaPct ?? 50;
  const leadScore = kpis.leadTime != null ? clamp(100 - (kpis.leadTime / 14) * 100) : 50;
  const convScore = kpis.conversion ?? 50;
  const marginScore = kpis.margin != null ? clamp((kpis.margin / 30) * 100) : 50;
  const backlogPressure = kpis.received > 0 ? clamp(100 - (kpis.backlog / kpis.received) * 50) : 50;
  const score = Math.round(
    slaScore * 0.30 + leadScore * 0.20 + convScore * 0.20 +
    marginScore * 0.15 + backlogPressure * 0.15,
  );
  let diagnosis: "excellent" | "healthy" | "warning" | "critical";
  if (score >= 85) diagnosis = "excellent";
  else if (score >= 70) diagnosis = "healthy";
  else if (score >= 50) diagnosis = "warning";
  else diagnosis = "critical";
  return { score, diagnosis };
}

async function generateSnapshot(snapshotDate: string) {
  const now = new Date();
  const dayStart = new Date(`${snapshotDate}T00:00:00Z`);
  const dayEnd = new Date(`${snapshotDate}T23:59:59Z`);
  const weekAgo = new Date(now.getTime() - 7 * 86400 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400 * 1000);

  // 1. Pega todos os budgets desde início das operações
  const budgets = await sb(
    `/rest/v1/budgets?select=id,internal_status,created_at,due_at,closed_at,manual_total,internal_cost,estimator_owner_id,commercial_owner_id&created_at=gte.${OPERATIONS_START}&limit=10000`,
  ) as BudgetRow[];

  const sections = await sb(
    `/rest/v1/sections?select=budget_id,section_price&limit=20000`,
  ) as SectionRow[];

  // Compute total per budget (manual_total OR sum of section_price)
  const sectionsByBudget = new Map<string, number>();
  for (const s of sections) {
    sectionsByBudget.set(s.budget_id, (sectionsByBudget.get(s.budget_id) ?? 0) + (s.section_price ?? 0));
  }
  const totalOf = (b: BudgetRow) => b.manual_total ?? sectionsByBudget.get(b.id) ?? 0;

  // 2. Volume métricas
  const receivedToday = budgets.filter((b) => b.created_at >= dayStart.toISOString() && b.created_at <= dayEnd.toISOString()).length;
  const active = budgets.filter((b) => ACTIVE_STATUSES.includes(b.internal_status));
  const closed = budgets.filter((b) => CLOSED_STATUSES.includes(b.internal_status));
  const overdue = active.filter((b) => b.due_at && new Date(b.due_at) < now).length;
  const inAnalysis = budgets.filter((b) => b.internal_status === "em_analise").length;
  const deliveredToSales = budgets.filter((b) => b.internal_status === "delivered_to_sales").length;
  const published = budgets.filter((b) => b.internal_status === "published" || b.internal_status === "minuta_solicitada").length;

  // 3. SLA
  const withDue = active.filter((b) => b.due_at);
  const onTime = withDue.filter((b) => new Date(b.due_at!) >= now).length;
  const slaPct = withDue.length > 0 ? Math.round((onTime / withDue.length) * 10000) / 100 : null;
  const atRisk48h = withDue.filter((b) => {
    const diff = (new Date(b.due_at!).getTime() - now.getTime()) / (1000 * 60 * 60);
    return diff > 0 && diff <= 48;
  }).length;
  const breached = withDue.filter((b) => new Date(b.due_at!) < now).length;

  // 4. Lead time via RPC (eventos)
  let avgLead: number | null = null;
  let medianLead: number | null = null;
  try {
    const leadResp = await sb(
      `/rest/v1/rpc/calc_lead_time_from_events`,
      {
        method: "POST",
        body: JSON.stringify({
          p_from: new Date(now.getTime() - 90 * 86400 * 1000).toISOString(),
          p_to: now.toISOString(),
        }),
      },
    ) as Array<{ avg_days: number; median_days: number; sample_size: number }>;
    if (leadResp.length > 0) {
      avgLead = leadResp[0].avg_days;
      medianLead = leadResp[0].median_days;
    }
  } catch (err) {
    console.error("Lead time RPC failed:", err);
  }

  // 5. Comercial
  const won = closed.filter((b) => b.internal_status === "contrato_fechado");
  const conversion = closed.length > 0 ? Math.round((won.length / closed.length) * 10000) / 100 : null;
  const portfolioValue = active.reduce((s, b) => s + totalOf(b), 0);
  const revenue = won.reduce((s, b) => s + totalOf(b), 0);
  const avgTicket = won.length > 0 ? Math.round((revenue / won.length) * 100) / 100 : null;
  const totalCost = won.reduce((s, b) => s + (b.internal_cost ?? 0), 0);
  const margin = revenue > 0 ? Math.round(((revenue - totalCost) / revenue) * 10000) / 100 : null;

  // 6. Throughput
  const wonThisWeek = won.filter((b) => b.closed_at && new Date(b.closed_at) >= weekAgo).length;
  const wonLastWeek = won.filter((b) => b.closed_at && new Date(b.closed_at) >= twoWeeksAgo && new Date(b.closed_at) < weekAgo).length;
  const throughputTrend = wonLastWeek > 0 ? Math.round(((wonThisWeek - wonLastWeek) / wonLastWeek) * 10000) / 100 : null;

  // 7. Saúde
  const { score, diagnosis } = calcHealthScore({
    slaPct, leadTime: avgLead, conversion, margin,
    backlog: active.length, received: receivedToday,
  });

  // 8. Equipe
  const estimatorIds = new Set(active.map((b) => b.estimator_owner_id).filter(Boolean) as string[]);
  const commercialIds = new Set(active.map((b) => b.commercial_owner_id).filter(Boolean) as string[]);
  const loadByEstimator: Record<string, number> = {};
  for (const b of active) {
    if (b.estimator_owner_id) {
      loadByEstimator[b.estimator_owner_id] = (loadByEstimator[b.estimator_owner_id] ?? 0) + 1;
    }
  }

  // 9. Funis estruturais
  const opStages = ["novo", "em_analise", "em_revisao", "delivered_to_sales"];
  const commStages = ["delivered_to_sales", "published", "minuta_solicitada", "contrato_fechado"];
  const opFunnel = opStages.map((s) => ({ status: s, count: budgets.filter((b) => b.internal_status === s).length }));
  const commFunnel = commStages.map((s) => ({ status: s, count: budgets.filter((b) => b.internal_status === s).length }));

  // 10. Aging buckets
  const buckets = [
    { label: "0-3d", min: 0, max: 3 },
    { label: "4-7d", min: 4, max: 7 },
    { label: "8-14d", min: 8, max: 14 },
    { label: "15+d", min: 15, max: Infinity },
  ];
  const aging = buckets.map((b) => ({
    label: b.label,
    count: active.filter((budget) => {
      const ageDays = (now.getTime() - new Date(budget.created_at).getTime()) / 86400000;
      return ageDays >= b.min && ageDays <= b.max;
    }).length,
  }));

  // 11. UPSERT snapshot
  const payload = {
    snapshot_date: snapshotDate,
    generated_at: now.toISOString(),
    received_count: receivedToday,
    backlog_count: active.length,
    overdue_count: overdue,
    closed_count: closed.length,
    in_analysis_count: inAnalysis,
    delivered_to_sales_count: deliveredToSales,
    published_count: published,
    sla_on_time_pct: slaPct,
    sla_at_risk_count: atRisk48h,
    sla_breach_48h_count: breached,
    avg_lead_time_days: avgLead,
    median_lead_time_days: medianLead,
    conversion_rate_pct: conversion,
    portfolio_value_brl: portfolioValue,
    revenue_brl: revenue,
    avg_ticket_brl: avgTicket,
    gross_margin_pct: margin,
    weekly_throughput: wonThisWeek,
    throughput_trend_pct: throughputTrend,
    health_score: score,
    health_diagnosis: diagnosis,
    active_estimators: estimatorIds.size,
    active_commercial: commercialIds.size,
    team_load_distribution: loadByEstimator,
    operational_funnel: opFunnel,
    commercial_funnel: commFunnel,
    aging_buckets: aging,
  };

  await sb(`/rest/v1/daily_metrics_snapshot?on_conflict=snapshot_date`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });

  // 12. Cleanup snapshots > 1 ano
  let deleted = 0;
  try {
    const cleanupResp = await sb(`/rest/v1/rpc/cleanup_old_snapshots`, {
      method: "POST",
      body: "{}",
    }) as number;
    deleted = cleanupResp ?? 0;
  } catch (err) {
    console.error("Cleanup failed:", err);
  }

  // 13. Disparar alertas proativos baseados no snapshot recém-criado
  let alertsCreated = 0;
  try {
    const alertResp = await sb(`/rest/v1/rpc/check_and_create_alerts`, {
      method: "POST",
      body: "{}",
    }) as number;
    alertsCreated = alertResp ?? 0;
  } catch (err) {
    console.error("Alerts check failed:", err);
  }

  return { snapshot: payload, cleaned: deleted, alerts_created: alertsCreated };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let dateParam: string;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      dateParam = body.date ?? new Date().toISOString().slice(0, 10);
    } else {
      dateParam = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return new Response(JSON.stringify({ error: "Invalid date format (use YYYY-MM-DD)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await generateSnapshot(dateParam);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("snapshot-daily-metrics error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
