import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface RevisionRequestInfo {
  requestedAt: string;
  requestedByName: string;
  instructions: string;
}

/**
 * Fetches the most recent `revision_requested` event for each given budget id.
 * Returns a map keyed by budget id with author/date/instructions for tooltips.
 */
export function useRevisionRequests(budgetIds: string[]) {
  const [map, setMap] = useState<Record<string, RevisionRequestInfo>>({});

  // Stable key to avoid re-fetching when array reference changes but contents don't
  const key = budgetIds.slice().sort().join(",");

  useEffect(() => {
    if (!key) {
      setMap({});
      return;
    }
    let cancelled = false;

    async function load() {
      const ids = key.split(",").filter(Boolean);
      if (ids.length === 0) {
        setMap({});
        return;
      }

      const { data, error } = await supabase
        .from("budget_events")
        .select("budget_id, created_at, metadata")
        .in("budget_id", ids)
        .eq("event_type", "revision_requested")
        .order("created_at", { ascending: false });

      if (error) {
        logger.warn("[useRevisionRequests] fetch failed", error);
        return;
      }
      if (cancelled) return;

      const next: Record<string, RevisionRequestInfo> = {};
      for (const ev of data ?? []) {
        if (next[ev.budget_id]) continue; // first row per budget = most recent
        const meta = (ev.metadata ?? {}) as Record<string, unknown>;
        next[ev.budget_id] = {
          requestedAt: ev.created_at,
          requestedByName: String(meta.requested_by_name ?? "Comercial"),
          instructions: String(meta.instructions ?? ""),
        };
      }
      setMap(next);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}
