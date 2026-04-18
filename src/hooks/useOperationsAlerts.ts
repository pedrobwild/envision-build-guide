import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OperationsAlert {
  id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metric_name: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  snapshot_date: string | null;
  resolved: boolean;
  created_at: string;
}

export function useOperationsAlerts(includeResolved = false, refreshKey = 0) {
  const [data, setData] = useState<OperationsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("operations_alerts")
        .select("id,alert_type,severity,title,message,metric_name,metric_value,threshold_value,snapshot_date,resolved,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!includeResolved) q = q.eq("resolved", false);
      const { data: rows, error: err } = await q;
      if (cancelled) return;
      if (err) setError(err.message);
      else setData((rows ?? []) as OperationsAlert[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [includeResolved, refreshKey]);

  const resolve = async (id: string) => {
    const { error: err } = await supabase
      .from("operations_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    return err?.message ?? null;
  };

  return { data, loading, error, resolve };
}
