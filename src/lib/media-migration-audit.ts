import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import { logger } from "@/lib/logger";

export type MediaMigrationAction = "updated" | "skipped";

export interface MediaMigrationAuditEntry {
  batch_name: string;
  budget_id: string | null;
  budget_label?: string | null;
  action: MediaMigrationAction;
  reason?: string | null;
  source_budget_id?: string | null;
  media_before?: unknown;
  media_after?: unknown;
  triggered_by?: string | null;
}

/**
 * Registra uma ou mais entradas na trilha de auditoria de migração de mídia.
 * Fire-and-forget: falhas não interrompem o fluxo principal.
 */
export async function logMediaMigrationAudit(
  entries: MediaMigrationAuditEntry | MediaMigrationAuditEntry[]
) {
  const list = Array.isArray(entries) ? entries : [entries];
  if (list.length === 0) return;

  try {
    const { error } = await supabase.from("media_migration_audit").insert(
      list.map((e) => ({
        batch_name: e.batch_name,
        budget_id: e.budget_id,
        budget_label: e.budget_label ?? null,
        action: e.action,
        reason: e.reason ?? null,
        source_budget_id: e.source_budget_id ?? null,
        media_before: (e.media_before ?? null) as Json,
        media_after: (e.media_after ?? null) as Json,
        triggered_by: e.triggered_by ?? null,
      }))
    );
    if (error) {
      logger.warn("[media-migration-audit] insert falhou:", error.message);
    }
  } catch (err) {
    logger.warn("[media-migration-audit] erro inesperado:", err);
  }
}

/**
 * Lê os registros mais recentes de um lote de migração.
 * Útil para a página de auditoria administrativa.
 */
export async function getMediaMigrationBatch(batchName: string) {
  const { data, error } = await supabase
    .from("media_migration_audit")
    .select("*")
    .eq("batch_name", batchName)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("[media-migration-audit] read falhou:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Resumo agregado por lote: quantos atualizados vs ignorados.
 */
export async function getMediaMigrationSummary(batchName: string) {
  const rows = await getMediaMigrationBatch(batchName);
  const updated = rows.filter((r) => r.action === "updated").length;
  const skipped = rows.filter((r) => r.action === "skipped").length;
  return { batchName, total: rows.length, updated, skipped, rows };
}
