import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BulkOperationPlan } from "./types";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-bulk-operations`;

function newRequestId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now().toString(36)}-${rand.slice(0, 8)}`;
}

async function callFn<T>(body: Record<string, unknown>, prefix = "bulk"): Promise<T> {
  const requestId = newRequestId(prefix);
  const { data: { session } } = await supabase.auth.getSession();
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ ...body, request_id: requestId }),
  });
  const json = await resp.json().catch(() => ({} as Record<string, unknown>));
  const echoedId = (json as { request_id?: string })?.request_id ?? resp.headers.get("x-request-id") ?? requestId;
  if (!resp.ok || (json as { error?: string })?.error) {
    const baseMsg = (json as { error?: string })?.error ?? `HTTP ${resp.status}`;
    const err = new Error(`${baseMsg} (req_id: ${echoedId})`);
    (err as Error & { requestId?: string }).requestId = echoedId;
    throw err;
  }
  return json as T;
}

export type BulkApplyProgress = {
  done: number;
  total: number;
  phase: string | null;
  heartbeat_at: string | null;
  started_at: string | null;
};

export type BulkApplyResult = {
  ok: boolean;
  applied_count: number;
  partial_failures?: number;
  failure_sample?: Array<{ id: string; error: string }>;
  background?: boolean;
};

export function useBulkOperations() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const cancelRef = useRef<{ [opId: string]: boolean }>({});

  const plan = useCallback(
    async (
      command: string,
    ): Promise<
      | (BulkOperationPlan & { will_run_in_background?: boolean; background_threshold?: number })
      | { unsupported: true; summary: string; reasoning?: string }
      | { empty: true; summary: string }
    > => {
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
        will_run_in_background?: boolean;
        background_threshold?: number;
      }>({ action: "plan", command }, "plan");

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
        will_run_in_background: res.will_run_in_background,
        background_threshold: res.background_threshold,
      };
    },
    [],
  );

  /**
   * Aplica a operação. Se o backend executar em background (operações com 50+
   * orçamentos), automaticamente faz polling de status até concluir, chamando
   * onProgress com o progresso atualizado.
   *
   * Retorna o resultado final agregado.
   */
  const apply = useCallback(
    async (
      operationId: string,
      onProgress?: (p: BulkApplyProgress & { status: string }) => void,
    ): Promise<BulkApplyResult> => {
      setBusyId(operationId);
      cancelRef.current[operationId] = false;
      try {
        const initial = await callFn<{
          ok: boolean;
          background?: boolean;
          applied_count?: number;
          partial_failures?: number;
          failure_sample?: Array<{ id: string; error: string }>;
          poll_interval_ms?: number;
        }>({ action: "apply", operation_id: operationId }, "apply");

        // Se foi síncrono, terminamos.
        if (!initial.background) {
          return {
            ok: initial.ok,
            applied_count: initial.applied_count ?? 0,
            partial_failures: initial.partial_failures,
            failure_sample: initial.failure_sample,
            background: false,
          };
        }

        // Modo background: faz polling até "applied" | "failed".
        const interval = Math.max(1500, initial.poll_interval_ms ?? 2000);
        const maxWaitMs = 15 * 60 * 1000; // 15 min de teto
        const start = Date.now();

        while (true) {
          if (cancelRef.current[operationId]) {
            throw new Error("Polling cancelado pelo usuário.");
          }
          if (Date.now() - start > maxWaitMs) {
            throw new Error("Tempo limite de espera atingido (15 min). A operação pode continuar em background — verifique o histórico.");
          }
          await new Promise((r) => setTimeout(r, interval));
          const status = await callFn<{
            ok: boolean;
            status: "pending" | "running" | "applied" | "failed" | "reverted";
            progress: BulkApplyProgress;
            error_message?: string;
          }>({ action: "status", operation_id: operationId }, "status");

          onProgress?.({ ...status.progress, status: status.status });

          if (status.status === "applied") {
            return {
              ok: true,
              applied_count: status.progress.done,
              partial_failures: 0,
              background: true,
            };
          }
          if (status.status === "failed") {
            throw new Error(status.error_message ?? "Operação falhou em background.");
          }
        }
      } finally {
        setBusyId(null);
        delete cancelRef.current[operationId];
      }
    },
    [],
  );

  const cancelPolling = useCallback((operationId: string) => {
    cancelRef.current[operationId] = true;
  }, []);

  const revert = useCallback(async (operationId: string) => {
    setBusyId(operationId);
    try {
      return await callFn<{ ok: boolean }>({
        action: "revert",
        operation_id: operationId,
      }, "revert");
    } finally {
      setBusyId(null);
    }
  }, []);

  return { plan, apply, revert, cancelPolling, busyId };
}
