/**
 * Import Leads CSV — recebe um lote de leads (já normalizados pelo front)
 * extraídos de uma planilha (Google Sheets / CSV / XLSX) e os ingere via
 * o pipeline padrão `ingestLead`. A atribuição de comercial usa as
 * `lead_routing_rules` ativas (round-robin ou fixo).
 *
 * Auth: JWT obrigatório + role admin OU comercial.
 *
 * Request body:
 * {
 *   "rows": NormalizedLead[],         // máx 500 por chamada
 *   "default_source"?: string,        // aplicado se a row não trouxer source
 *   "dry_run"?: boolean               // se true, valida mas não persiste
 * }
 *
 * Response:
 * {
 *   "total": N,
 *   "processed": N,
 *   "duplicate": N,
 *   "failed": N,
 *   "errors": [{ row_index, error }]
 * }
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ingestLead, type NormalizedLead } from "../_shared/lead-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS_PER_CALL = 500;

interface ImportBody {
  rows?: Array<Partial<NormalizedLead> & { row_index?: number }>;
  default_source?: string;
  dry_run?: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: "Server not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: userError } =
    await adminClient.auth.getUser(token);
  if (userError || !caller) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }

  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("comercial")) {
    return jsonResponse({ error: "Admin/comercial role required" }, 403);
  }

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return jsonResponse({ error: "rows is required and must be non-empty" }, 400);
  }
  if (rows.length > MAX_ROWS_PER_CALL) {
    return jsonResponse(
      { error: `Maximum ${MAX_ROWS_PER_CALL} rows per call`, total: rows.length },
      400,
    );
  }

  const defaultSource = body.default_source?.trim() || "google_sheets";
  const dryRun = body.dry_run === true;

  const summary = {
    total: rows.length,
    processed: 0,
    duplicate: 0,
    failed: 0,
    errors: [] as Array<{ row_index: number; error: string }>,
    dry_run: dryRun,
  };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] ?? {};
    const rowIndex = typeof raw.row_index === "number" ? raw.row_index : i;

    const name = (raw.name ?? "").toString().trim();
    const email = raw.email ? raw.email.toString().trim() : null;
    const phone = raw.phone ? raw.phone.toString().trim() : null;

    if (!name && !email && !phone) {
      summary.failed += 1;
      summary.errors.push({
        row_index: rowIndex,
        error: "Linha sem name, email ou phone",
      });
      continue;
    }

    const source = (raw.source ?? defaultSource).toString().trim();

    const normalized: NormalizedLead = {
      source,
      external_id: raw.external_id ? raw.external_id.toString().trim() : null,
      name: name || "Lead sem nome",
      email,
      phone,
      campaign_id: raw.campaign_id ?? null,
      campaign_name: raw.campaign_name ?? null,
      adset_id: raw.adset_id ?? null,
      adset_name: raw.adset_name ?? null,
      ad_id: raw.ad_id ?? null,
      ad_name: raw.ad_name ?? null,
      form_id: raw.form_id ?? null,
      form_name: raw.form_name ?? null,
      utm_source: raw.utm_source ?? null,
      utm_medium: raw.utm_medium ?? null,
      utm_campaign: raw.utm_campaign ?? null,
      utm_content: raw.utm_content ?? null,
      utm_term: raw.utm_term ?? null,
      city: raw.city ?? null,
      bairro: raw.bairro ?? null,
      lead_captured_at: raw.lead_captured_at ?? null,
      platform: raw.platform ?? null,
      raw_payload: {
        ...raw,
        _imported_by: caller.id,
        _imported_at: new Date().toISOString(),
      },
    };

    if (dryRun) {
      summary.processed += 1;
      continue;
    }

    try {
      const result = await ingestLead(adminClient, normalized);
      if (result.status === "processed") summary.processed += 1;
      else if (result.status === "duplicate") summary.duplicate += 1;
      else {
        summary.failed += 1;
        summary.errors.push({
          row_index: rowIndex,
          error: result.error ?? "Falha desconhecida",
        });
      }
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({
        row_index: rowIndex,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse(summary, 200);
});
