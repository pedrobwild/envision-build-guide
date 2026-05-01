import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

import { logger } from "@/lib/logger";

export type VersionEventType =
  | "version_created"
  | "version_cloned_from_previous"
  | "version_published"
  | "version_superseded"
  | "version_compared"
  | "version_activated"
  | "change_reason_updated"
  | "revision_requested"
  | "addendum_created"
  | "addendum_approved"
  | "budget_deleted";

interface VersionEventPayload {
  event_type: VersionEventType;
  budget_id: string;
  user_id?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Log a version-related audit event to budget_events.
 * Lightweight — fire-and-forget, does not throw on failure.
 */
export async function logVersionEvent({
  event_type,
  budget_id,
  user_id,
  from_status,
  to_status,
  note,
  metadata = {},
}: VersionEventPayload) {
  try {
    await supabase.from("budget_events").insert({
      budget_id,
      event_type,
      user_id: user_id ?? null,
      from_status: from_status ?? null,
      to_status: to_status ?? null,
      metadata: metadata as Json,
      note: note ?? buildNote(event_type, metadata),
    });
  } catch (err) {
    logger.warn("[version-audit] Failed to log event:", err);
  }
}

function buildNote(
  event_type: VersionEventType,
  meta: Record<string, unknown>
): string {
  switch (event_type) {
    case "version_created":
      return `Versão V${meta.version_number ?? "?"} criada${meta.change_reason ? ` — ${meta.change_reason}` : ""}`;
    case "version_cloned_from_previous":
      return `Clonada a partir de V${meta.source_version ?? "?"}`;
    case "version_published":
      return `Versão V${meta.version_number ?? "?"} publicada com ID público ${meta.public_id ?? "—"}`;
    case "version_superseded":
      return `Versão V${meta.version_number ?? "?"} substituída`;
    case "version_compared":
      return `Comparação entre V${meta.left_version ?? "?"} e V${meta.right_version ?? "?"}`;
    case "version_activated":
      return `Versão V${meta.version_number ?? "?"} definida como atual`;
    case "change_reason_updated":
      return `Motivo atualizado: ${meta.change_reason ?? "—"}`;
    case "revision_requested":
      return `Revisão solicitada por ${meta.requested_by_name ?? "?"}: ${String(meta.instructions ?? "").slice(0, 100)}`;
    case "budget_deleted":
      return `Orçamento excluído (deleted_id=${meta.deleted_budget_id ?? "?"}, V${meta.version_number ?? "?"}, source=${meta.source ?? "?"})`;
    default:
      return event_type;
  }
}

/**
 * Log a budget deletion event.
 *
 * `budget_events` has FK ON DELETE CASCADE to `budgets.id`, so the audit row
 * cannot be anchored to the budget being deleted. Instead, anchor the event
 * on the most relevant surviving record, in this priority:
 *   1. parent_budget_id (if it still exists)
 *   2. any surviving sibling in the same version_group_id
 *   3. fall back to logger only (no audit row)
 *
 * Call this AFTER the deletion succeeds so we don't log spurious events for
 * deletions that fail downstream.
 */
export async function logBudgetDeletion(params: {
  deletedBudgetId: string;
  userId?: string | null;
  source: "deleteDraftVersion" | "safeDeleteBudget" | "rollback" | string;
  parentBudgetId?: string | null;
  versionGroupId?: string | null;
  versionNumber?: number | null;
  publicId?: string | null;
  isCurrentVersion?: boolean | null;
  isPublishedVersion?: boolean | null;
  status?: string | null;
}) {
  const metadata = {
    deleted_budget_id: params.deletedBudgetId,
    source: params.source,
    version_number: params.versionNumber ?? null,
    public_id: params.publicId ?? null,
    parent_budget_id: params.parentBudgetId ?? null,
    version_group_id: params.versionGroupId ?? null,
    was_current: params.isCurrentVersion ?? false,
    was_published: params.isPublishedVersion ?? false,
    status: params.status ?? null,
  };

  let anchor: string | null = null;
  if (params.parentBudgetId) {
    const { data } = await supabase
      .from("budgets")
      .select("id")
      .eq("id", params.parentBudgetId)
      .maybeSingle();
    if (data?.id) anchor = data.id;
  }
  if (!anchor && params.versionGroupId) {
    const { data } = await supabase
      .from("budgets")
      .select("id")
      .eq("version_group_id", params.versionGroupId)
      .neq("id", params.deletedBudgetId)
      .limit(1)
      .maybeSingle();
    if (data?.id) anchor = data.id;
  }

  if (!anchor) {
    logger.warn("[version-audit] budget_deleted: no surviving anchor — skipping audit row", metadata);
    return;
  }

  return logVersionEvent({
    event_type: "budget_deleted",
    budget_id: anchor,
    user_id: params.userId ?? null,
    metadata,
  });
}

/**
 * Fetch version-related audit events for a version group.
 */
export async function getVersionAuditEvents(budgetIds: string[]) {
  if (budgetIds.length === 0) return [];

  const versionEventTypes: VersionEventType[] = [
    "version_created",
    "version_cloned_from_previous",
    "version_published",
    "version_superseded",
    "version_compared",
    "version_activated",
    "change_reason_updated",
    "revision_requested",
    "budget_deleted",
  ];

  const { data, error } = await supabase
    .from("budget_events")
    .select("id, budget_id, event_type, note, metadata, user_id, created_at")
    .in("budget_id", budgetIds)
    .in("event_type", versionEventTypes)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    logger.warn("[version-audit] Failed to fetch events:", error);
    return [];
  }

  // Enrich with user names
  const userIds = [...new Set((data || []).map((e) => e.user_id).filter(Boolean))];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds as string[]);
    nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name || ""]));
  }

  return (data || []).map((e) => ({
    ...e,
    user_name: e.user_id ? nameMap[e.user_id] || "—" : "Sistema",
  }));
}

/**
 * Log a revision request event — fired when comercial asks orçamentista to revise.
 */
export async function logRevisionRequestEvent({
  budgetId,
  userId,
  instructions,
  changeTypes,
  requestedByName,
  fromStatus,
}: {
  budgetId: string;
  userId: string;
  instructions: string;
  changeTypes: string[];
  requestedByName: string;
  fromStatus: string;
}) {
  return logVersionEvent({
    event_type: "revision_requested",
    budget_id: budgetId,
    user_id: userId,
    from_status: fromStatus,
    to_status: "revision_requested",
    note: `Revisão solicitada por ${requestedByName}: ${instructions.slice(0, 100)}${instructions.length > 100 ? "…" : ""}`,
    metadata: {
      instructions,
      change_types: changeTypes,
      requested_by_name: requestedByName,
    },
  });
}
