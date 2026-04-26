import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BulkOperationPlan } from "./types";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-bulk-operations`;

async function callFn<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.error) {
    throw new Error(json?.error ?? `HTTP ${resp.status}`);
  }
  return json as T;
}

export function useBulkOperations() {
  const [busyId, setBusyId] = useState<string | null>(null);

  const plan = useCallback(
    async (command: string): Promise<BulkOperationPlan | { unsupported: true; summary: string; reasoning?: string } | { empty: true; summary: string }> => {
      const res = await callFn<{
        ok: boolean;
        unsupported?: boolean;
        empty?: boolean;
        operation_id?: string;
        action_type?: BulkOperationPlan["action_type"];
        summary?: string;
        reasoning?: string;
        filters?: BulkOperationPlan["filters"];
        params?: Record<string, unknown>;
        rows?: BulkOperationPlan["rows"];
        applicable_count?: number;
        protected_count?: number;
        total_before?: number;
        total_after?: number;
      }>({ action: "plan", command });

      if (res.unsupported) {
        return { unsupported: true, summary: res.summary ?? "", reasoning: res.reasoning };
      }
      if (res.empty) {
        return { empty: true, summary: res.summary ?? "" };
      }
      return {
        operation_id: res.operation_id!,
        action_type: res.action_type!,
        summary: res.summary ?? "",
        reasoning: res.reasoning,
        filters: res.filters!,
        params: res.params ?? {},
        rows: res.rows ?? [],
        applicable_count: res.applicable_count ?? 0,
        protected_count: res.protected_count ?? 0,
        total_before: res.total_before ?? 0,
        total_after: res.total_after ?? 0,
      };
    },
    [],
  );

  const apply = useCallback(async (operationId: string) => {
    setBusyId(operationId);
    try {
      return await callFn<{ ok: boolean; applied_count: number }>({
        action: "apply",
        operation_id: operationId,
      });
    } finally {
      setBusyId(null);
    }
  }, []);

  const revert = useCallback(async (operationId: string) => {
    setBusyId(operationId);
    try {
      return await callFn<{ ok: boolean }>({
        action: "revert",
        operation_id: operationId,
      });
    } finally {
      setBusyId(null);
    }
  }, []);

  return { plan, apply, revert, busyId };
}
