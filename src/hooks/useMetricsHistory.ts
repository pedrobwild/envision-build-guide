import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DailySnapshot {
  id: string;
  snapshot_date: string;
  generated_at: string;
  received_count: number;
  backlog_count: number;
  overdue_count: number;
  closed_count: number;
  in_analysis_count: number;
  delivered_to_sales_count: number;
  published_count: number;
  sla_on_time_pct: number | null;
  sla_at_risk_count: number;
  sla_breach_48h_count: number;
  avg_lead_time_days: number | null;
  median_lead_time_days: number | null;
  conversion_rate_pct: number | null;
  portfolio_value_brl: number;
  revenue_brl: number;
  avg_ticket_brl: number | null;
  gross_margin_pct: number | null;
  weekly_throughput: number | null;
  throughput_trend_pct: number | null;
  health_score: number | null;
  health_diagnosis: "excellent" | "healthy" | "warning" | "critical" | null;
  active_estimators: number;
  active_commercial: number;
}

interface State {
  data: DailySnapshot[];
  loading: boolean;
  error: string | null;
}

/**
 * Reads daily KPI snapshots for the last N days. Snapshots are produced by
 * the `snapshot-daily-metrics` edge function, scheduled by a cron job.
 */
export function useMetricsHistory(days = 30, refreshKey = 0) {
  const [state, setState] = useState<State>({ data: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("daily_metrics_snapshot")
        .select(
          "id,snapshot_date,generated_at,received_count,backlog_count,overdue_count,closed_count,in_analysis_count,delivered_to_sales_count,published_count,sla_on_time_pct,sla_at_risk_count,sla_breach_48h_count,avg_lead_time_days,median_lead_time_days,conversion_rate_pct,portfolio_value_brl,revenue_brl,avg_ticket_brl,gross_margin_pct,weekly_throughput,throughput_trend_pct,health_score,health_diagnosis,active_estimators,active_commercial",
        )
        .gte("snapshot_date", since)
        .order("snapshot_date", { ascending: true });

      if (cancelled) return;
      if (error) {
        setState({ data: [], loading: false, error: error.message });
        return;
      }
      setState({ data: (data ?? []) as unknown as DailySnapshot[], loading: false, error: null });
    })();
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  /** Trigger an on-demand snapshot for today (admins only via RLS). */
  const generateNow = async () => {
    const { error } = await supabase.functions.invoke("snapshot-daily-metrics", {
      body: { date: new Date().toISOString().slice(0, 10) },
    });
    return error?.message ?? null;
  };

  return { ...state, generateNow };
}
