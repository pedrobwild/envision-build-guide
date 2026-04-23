import { supabase } from "@/integrations/supabase/client";

export type MediaIntegrityAlertType =
  | "config_changed"
  | "count_mismatch"
  | "url_broken"
  | "missing_baseline";

export type MediaIntegrityAlertStatus = "open" | "acknowledged" | "resolved";

export interface MediaIntegrityAlert {
  id: string;
  budget_id: string;
  budget_label: string | null;
  alert_type: MediaIntegrityAlertType;
  severity: "info" | "warning" | "critical";
  details: Record<string, unknown>;
  baseline_snapshot: unknown;
  current_snapshot: unknown;
  status: MediaIntegrityAlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

/** Dispara verificação manual sob demanda. */
export async function runMediaIntegrityCheck(opts?: {
  check_urls?: boolean;
  url_sample_size?: number;
}) {
  const { data, error } = await supabase.functions.invoke("media-integrity-check", {
    body: { check_urls: true, url_sample_size: 5, ...(opts ?? {}) },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    summary: {
      checked: number;
      alerts_created: number;
      by_type: Record<string, number>;
      errors: string[];
    };
  };
}

/** Lista alertas (padrão: abertos, mais recentes primeiro). */
export async function listMediaIntegrityAlerts(opts?: {
  status?: MediaIntegrityAlertStatus | "all";
  limit?: number;
}) {
  let q = supabase
    .from("media_integrity_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  const status = opts?.status ?? "open";
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MediaIntegrityAlert[];
}

/** Marca o alerta como reconhecido (operador viu, mas não resolveu). */
export async function acknowledgeAlert(alertId: string) {
  const { error } = await supabase
    .from("media_integrity_alerts")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", alertId);
  if (error) throw error;
}

/**
 * Resolve o alerta E atualiza o baseline para a config atual,
 * tornando a mudança o novo "esperado".
 */
export async function resolveAlertAndRebaseline(
  alertId: string,
  budgetId: string,
  reason?: string
) {
  const { error: rebaseErr } = await supabase.rpc("mark_budget_as_manual_baseline", {
    p_budget_id: budgetId,
    p_reason: reason ?? "Re-baseline após alerta resolvido",
  });
  if (rebaseErr) throw rebaseErr;

  const { error } = await supabase
    .from("media_integrity_alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", alertId);
  if (error) throw error;
}

/** Marca um orçamento como tendo upload manual e captura baseline atual. */
export async function captureManualBaseline(budgetId: string, reason?: string) {
  const { error } = await supabase.rpc("mark_budget_as_manual_baseline", {
    p_budget_id: budgetId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}
