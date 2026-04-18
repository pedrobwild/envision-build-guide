import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StageDuration {
  stage: string;
  avg_days: number | null;
  median_days: number | null;
  p90_days: number | null;
  sample_size: number;
}

export function useTimeInStage(days = 90, refreshKey = 0) {
  const [data, setData] = useState<StageDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const to = new Date().toISOString();
      const from = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: rows, error: err } = await supabase.rpc("calc_time_in_stage" as never, {
        p_from: from,
        p_to: to,
      } as never);
      if (cancelled) return;
      if (err) setError(err.message);
      else setData((rows ?? []) as StageDuration[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [days, refreshKey]);

  return { data, loading, error };
}
