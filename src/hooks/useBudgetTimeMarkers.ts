import { useCallback, useEffect, useRef, useState } from "react";
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
 * recálculo manual no cliente.
 *
 * `refreshKey` invalida o cache local — pode ser primitivo, array ou objeto;
 * é serializado de forma estável para evitar refetches desnecessários quando
 * o caller reconstrói o valor a cada render.
 *
 * Também retorna `refetch` para forçar uma nova busca após uma mutação
 * conhecida (ex.: troca de status via dropdown), garantindo que o
 * `current_stage_start` reflita imediatamente o novo evento.
 */
export function useBudgetTimeMarkers(
  budgetId: string | null | undefined,
  refreshKey: unknown = 0,
) {
  const [data, setData] = useState<BudgetTimeMarkers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualTick, setManualTick] = useState(0);

  // Serializa o refreshKey de forma estável para o array de dependências.
  // Evita refetch quando o caller passa um novo objeto/array com mesmo conteúdo.
  const serializedKey = stableSerialize(refreshKey);
  const inflight = useRef<AbortController | null>(null);

  const refetch = useCallback(() => {
    setManualTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!budgetId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    // Cancela request anterior em voo se a key mudar antes de resolver.
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;

    setLoading(true);
    setError(null);
    (async () => {
      const { data: rows, error: err } = await supabase.rpc(
        "get_budget_time_markers" as never,
        { p_budget_id: budgetId } as never,
      );
      if (ctrl.signal.aborted) return;
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
      ctrl.abort();
    };
  }, [budgetId, serializedKey, manualTick]);

  return { data, loading, error, refetch };
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return `${t}:${String(value)}`;
  try {
    return JSON.stringify(value, Object.keys(value as object).sort());
  } catch {
    return String(value);
  }
}
