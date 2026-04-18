/**
 * Reprocessamento de leads falhados.
 *
 * Lê leads em `lead_sources` com `processing_status = 'failed'` recentes (últimos 7 dias)
 * e tenta re-executar o pipeline `ingestLead` a partir do `raw_payload` armazenado.
 *
 * Pode ser invocado:
 *  - Manualmente pelo admin (UI)
 *  - Por cron job diário
 *
 * Auth: requer JWT de admin OU header `x-integration-key`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestLead, type NormalizedLead } from "../_shared/lead-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-integration-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LeadSourceRow {
  id: string;
  source: string;
  external_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  form_id: string | null;
  form_name: string | null;
  raw_payload: Record<string, unknown>;
}

function extractFromRawPayload(row: LeadSourceRow): NormalizedLead | null {
  const raw = row.raw_payload ?? {};

  // Caso 1: payload do meta-webhook ({ entry, change, lead_full, fields })
  const fields = (raw as { fields?: Record<string, string> }).fields;
  if (fields) {
    const fullName =
      fields["full_name"] ||
      [fields["first_name"], fields["last_name"]].filter(Boolean).join(" ") ||
      fields["name"] ||
      "Lead Meta";
    return {
      source: row.source,
      external_id: row.external_id,
      name: fullName,
      email: fields["email"] || null,
      phone: fields["phone_number"] || fields["phone"] || null,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      adset_id: row.adset_id,
      adset_name: row.adset_name,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      form_id: row.form_id,
      form_name: row.form_name,
      city: fields["city"] || null,
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: row.campaign_name ?? row.campaign_id,
      raw_payload: raw,
    };
  }

  // Caso 2: payload do lead-webhook genérico ({ body, extra })
  const body = (raw as { body?: Record<string, unknown> }).body as
    | (NormalizedLead & { name?: string })
    | undefined;
  if (body && (body.email || body.phone || body.name)) {
    return {
      source: row.source,
      external_id: row.external_id,
      name: (body.name as string) || "Lead sem nome",
      email: (body.email as string) ?? null,
      phone: (body.phone as string) ?? null,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      adset_id: row.adset_id,
      adset_name: row.adset_name,
      ad_id: row.ad_id,
      ad_name: row.ad_name,
      form_id: row.form_id,
      form_name: row.form_name,
      city: (body.city as string) ?? null,
      bairro: (body.bairro as string) ?? null,
      utm_source: (body.utm_source as string) ?? null,
      utm_medium: (body.utm_medium as string) ?? null,
      utm_campaign: (body.utm_campaign as string) ?? null,
      utm_content: (body.utm_content as string) ?? null,
      utm_term: (body.utm_term as string) ?? null,
      raw_payload: raw,
    };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const INTEGRATION_KEY = Deno.env.get("INTEGRATION_INBOUND_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: integration key OU usuário admin
  const integrationKey = req.headers.get("x-integration-key");
  let authorized = integrationKey && integrationKey === INTEGRATION_KEY;

  if (!authorized) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (error || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    authorized = true;
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: failed, error: listErr } = await supabase.rpc("list_failed_lead_sources", {
    p_limit: 50,
  });
  if (listErr) {
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (failed ?? []) as LeadSourceRow[];
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of rows) {
    const normalized = extractFromRawPayload(row);
    if (!normalized) {
      results.push({ id: row.id, status: "skipped_no_data" });
      continue;
    }
    const result = await ingestLead(supabase, normalized);
    results.push({ id: row.id, status: result.status, error: result.error });
  }

  return new Response(
    JSON.stringify({ success: true, processed: rows.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
