import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type PublicAuditEvent =
  | "public_budget_view"
  | "public_budget_pdf_export"
  | "public_optional_selection"
  | "public_contract_request_started"
  | "public_contract_request_submitted"
  | "public_link_invalid";

const sentKeys = new Set<string>();

/**
 * Registra um evento de acesso público (best-effort).
 * Usa RPC `log_public_budget_access` (SECURITY DEFINER) que valida event_type
 * e captura IP/UA via headers PostgREST. Falhas são silenciosas.
 *
 * `dedupKey` evita duplo registro do mesmo evento na mesma sessão (ex.: StrictMode).
 */
export async function logPublicAccess(params: {
  publicId: string;
  event: PublicAuditEvent;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
}): Promise<void> {
  if (!params.publicId) return;
  const key = params.dedupKey ?? `${params.event}:${params.publicId}`;
  if (sentKeys.has(key)) return;
  sentKeys.add(key);

  try {
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    const route = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
    const { error } = await supabase.rpc("log_public_budget_access" as never, {
      p_public_id: params.publicId,
      p_event_type: params.event,
      p_metadata: (params.metadata ?? {}) as never,
      p_referrer: referrer,
      p_route: route,
    } as never);
    if (error) {
      logger.warn("[access-audit] log failed", { event: params.event, error: error.message });
    }
  } catch (err) {
    logger.warn("[access-audit] log threw", err);
  }
}
