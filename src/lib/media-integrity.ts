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
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

export interface MediaIntegritySummary {
  totalBudgets: number;
  manualPreserved: number;
  replicated: number;
  pending: number;
  openAlerts: number;
  sample: Array<{
    id: string;
    label: string;
    bucket: "manual" | "replicado" | "pendente";
    publicId: string | null;
  }>;
  generatedAt: string;
}

type MediaConfigShape = {
  video3d?: string;
  projeto3d?: string[];
  projetoExecutivo?: string[];
  fotos?: string[];
};

function classifyBudget(mc: MediaConfigShape | null | undefined): "manual" | "replicado" | "pendente" {
  if (!mc || typeof mc !== "object") return "pendente";
  const hasVideo = typeof mc.video3d === "string" && mc.video3d.trim().length > 0;
  const hasFotos = Array.isArray(mc.fotos) && mc.fotos.length > 0;
  const hasExec = Array.isArray(mc.projetoExecutivo) && mc.projetoExecutivo.length > 0;
  // Mídia "manual" = qualquer categoria além de só projeto3d.
  if (hasVideo || hasFotos || hasExec) return "manual";
  const has3d = Array.isArray(mc.projeto3d) && mc.projeto3d.length > 0;
  // Só projeto3d preenchido = replicado pelo template/fallback.
  if (has3d) return "replicado";
  return "pendente";
}

/**
 * Computa um resumo rápido para validação visual da replicação de mídia:
 *  - manuais preservados (vídeo/fotos/exec) — devem permanecer intocados
 *  - replicados (apenas projeto3d, vindo do template/fallback)
 *  - pendentes (sem mídia alguma)
 *  - alertas abertos no monitor
 */
export async function getMediaIntegritySummary(): Promise<MediaIntegritySummary> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, project_name, client_name, public_id, media_config")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    project_name: string | null;
    client_name: string | null;
    public_id: string | null;
    media_config: MediaConfigShape | null;
  }>;

  let manualPreserved = 0;
  let replicated = 0;
  let pending = 0;
  const sample: MediaIntegritySummary["sample"] = [];
  const sampleQuotas = { manual: 3, replicado: 3, pendente: 3 };

  for (const r of rows) {
    const bucket = classifyBudget(r.media_config);
    if (bucket === "manual") manualPreserved++;
    else if (bucket === "replicado") replicated++;
    else pending++;

    if (sampleQuotas[bucket] > 0) {
      sample.push({
        id: r.id,
        label: `${r.project_name ?? "—"} (${r.client_name ?? "—"})`.slice(0, 80),
        bucket,
        publicId: r.public_id,
      });
      sampleQuotas[bucket]--;
    }
  }

  const { count: openAlertsCount } = await supabase
    .from("media_integrity_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  return {
    totalBudgets: rows.length,
    manualPreserved,
    replicated,
    pending,
    openAlerts: openAlertsCount ?? 0,
    sample,
    generatedAt: new Date().toISOString(),
  };
}

