import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetTimeMarkers {
  budget_id: string;
  internal_status: string;
  created_at: string;
  current_stage_start: string;
  frozen_at: string | null;
  is_frozen: boolean;
  reference_at: string;
}

/**
 * Busca os marcos de tempo do orçamento no backend (RPC `get_budget_time_markers`).
 * É a fonte de verdade para "Aberto há X dias" e "Nesta etapa há X dias", evitando
 * recálculo manual no cliente — `refreshKey` permite invalidar após mudança de status.
 */
export function useBudgetTimeMarkers(budgetId: string | null | undefined, refreshKey: unknown = 0) {
  const [data, setData] = useState<BudgetTimeMarkers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!budgetId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data: rows, error: err } = await supabase.rpc(
        "get_budget_time_markers" as never,
        { p_budget_id: budgetId } as never,
      );
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setData(null);
      } else {
        const row = Array.isArray(rows) ? (rows[0] as BudgetTimeMarkers | undefined) : null;
        setData(row ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [budgetId, refreshKey]);

  return { data, loading, error };
}
