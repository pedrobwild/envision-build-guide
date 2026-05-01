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
  | "version_deleted"
  | "change_reason_updated"
  | "revision_requested"
  | "addendum_created"
  | "addendum_approved";

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
    case "version_deleted":
      return `Versão V${meta.deleted_version_number ?? "?"} excluída (rascunho)`;
    case "change_reason_updated":
      return `Motivo atualizado: ${meta.change_reason ?? "—"}`;
    case "revision_requested":
      return `Revisão solicitada por ${meta.requested_by_name ?? "?"}: ${String(meta.instructions ?? "").slice(0, 100)}`;
    default:
      return event_type;
  }
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
