import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ForecastBucket {
  monthKey: string;          // YYYY-MM
  monthLabel: string;        // "Mai/26"
  monthStart: Date;
  weighted: number;          // Σ total × win_probability/100 (open deals)
  unweighted: number;        // Σ total (open deals)
  dealsCount: number;        // open deals com expected_close_at no mês
  closedRevenue: number;     // Σ total de fechados (contrato_fechado) no mês
  closedDeals: number;       // # de fechados no mês
  revenueTarget: number;     // meta vinda de commercial_targets (global)
  dealsTarget: number;       // meta de fechamentos
  attainmentPct: number | null; // closedRevenue / revenueTarget * 100
}

interface BudgetForecastRow {
  id: string;
  manual_total: number | null;
  win_probability: number | null;
  internal_status: string;
  expected_close_at: string | null;
  closed_at: string | null;
  commercial_owner_id: string | null;
}

interface TargetRow {
  owner_id: string | null;
  target_month: string;
  revenue_target_brl: number;
  deals_target: number;
}

const OPEN_STATUSES = [
  "lead", "qualificacao", "briefing", "validacao_briefing", "em_analise",
  "em_revisao", "ready_for_review", "revision_requested",
  "delivered_to_sales", "published", "minuta_solicitada", "sent_to_client",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

export function useForecast(monthsAhead = 3, ownerFilter?: string | null) {
  const [data, setData] = useState<ForecastBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);

        // Open deals com expected_close_at no horizonte
        let q = supabase
          .from("budgets")
          .select("id, manual_total, win_probability, internal_status, expected_close_at, closed_at, commercial_owner_id")
          .or(`internal_status.in.(${OPEN_STATUSES.join(",")}),internal_status.eq.contrato_fechado`);

        if (ownerFilter) q = q.eq("commercial_owner_id", ownerFilter);

        const { data: budgets } = await q;

        // Metas (global ou por owner)
        const targetsQuery = supabase
          .from("commercial_targets")
          .select("owner_id, target_month, revenue_target_brl, deals_target")
          .gte("target_month", startMonth.toISOString().slice(0, 10))
          .lt("target_month", endMonth.toISOString().slice(0, 10));

        const { data: targets } = await targetsQuery;

        // Inicializa buckets
        const buckets: ForecastBucket[] = [];
        for (let i = 0; i < monthsAhead; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          buckets.push({
            monthKey: monthKey(d),
            monthLabel: monthLabel(d),
            monthStart: d,
            weighted: 0,
            unweighted: 0,
            dealsCount: 0,
            closedRevenue: 0,
            closedDeals: 0,
            revenueTarget: 0,
            dealsTarget: 0,
            attainmentPct: null,
          });
        }

        // Aplica metas (filtra por owner se aplicável, senão pega global owner_id IS NULL)
        (targets ?? []).forEach((t: TargetRow) => {
          const matches = ownerFilter ? t.owner_id === ownerFilter : t.owner_id === null;
          if (!matches) return;
          const tDate = new Date(t.target_month);
          const k = monthKey(tDate);
          const b = buckets.find((x) => x.monthKey === k);
          if (b) {
            b.revenueTarget = Number(t.revenue_target_brl ?? 0);
            b.dealsTarget = Number(t.deals_target ?? 0);
          }
        });

        // Soma valores
        (budgets as BudgetForecastRow[] | null ?? []).forEach((b) => {
          const total = Number(b.manual_total ?? 0);
          if (b.internal_status === "contrato_fechado") {
            const closeDate = b.closed_at ? new Date(b.closed_at) : null;
            if (!closeDate) return;
            const k = monthKey(closeDate);
            const bucket = buckets.find((x) => x.monthKey === k);
            if (bucket) {
              bucket.closedRevenue += total;
              bucket.closedDeals += 1;
            }
          } else if (b.expected_close_at) {
            const expDate = new Date(b.expected_close_at);
            const k = monthKey(expDate);
            const bucket = buckets.find((x) => x.monthKey === k);
            if (bucket) {
              const prob = Math.max(0, Math.min(100, Number(b.win_probability ?? 0)));
              bucket.weighted += total * (prob / 100);
              bucket.unweighted += total;
              bucket.dealsCount += 1;
            }
          }
        });

        // Calcula attainment
        buckets.forEach((b) => {
          b.attainmentPct = b.revenueTarget > 0
            ? (b.closedRevenue / b.revenueTarget) * 100
            : null;
        });

        if (alive) setData(buckets);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [monthsAhead, ownerFilter]);

  return { data, loading };
}
