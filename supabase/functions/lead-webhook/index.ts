/**
 * Lead Webhook genérico (Google Ads, formulários do site, TikTok, etc.)
 *
 * Endpoint público para integrações externas enviarem leads. Espera POST com:
 * {
 *   "source": "google_ads" | "site_form" | "tiktok_ads" | <string>,
 *   "external_id": "abc-123",      // opcional — usado para dedup
 *   "name": "João da Silva",
 *   "email": "joao@x.com",
 *   "phone": "+5511999999999",
 *   "campaign_id"?: string,
 *   "campaign_name"?: string,
 *   "adset_id"?: string,
 *   "adset_name"?: string,
 *   "ad_id"?: string,
 *   "ad_name"?: string,
 *   "form_id"?: string,
 *   "form_name"?: string,
 *   "utm_source"?: string,
 *   "utm_medium"?: string,
 *   "utm_campaign"?: string,
 *   "utm_content"?: string,
 *   "utm_term"?: string,
 *   "city"?: string,
 *   "bairro"?: string,
 *   "extra"?: { ... }              // qualquer dado extra (vai para raw_payload)
 * }
 *
 * Autenticação: header `x-integration-key` deve bater com `INTEGRATION_INBOUND_KEY`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestLead, type NormalizedLead } from "../_shared/lead-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-integration-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IncomingLeadBody {
  source?: string;
  external_id?: string | null;
  name?: string;
  email?: string | null;
  phone?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  form_id?: string | null;
  form_name?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  city?: string | null;
  bairro?: string | null;
  extra?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const INTEGRATION_KEY = Deno.env.get("INTEGRATION_INBOUND_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE || !INTEGRATION_KEY) {
    return new Response(
      JSON.stringify({ error: "Server not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const providedKey = req.headers.get("x-integration-key")?.trim();
  const expectedKey = INTEGRATION_KEY.trim();
  if (!providedKey || providedKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: IncomingLeadBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Validação básica
  if (!body.source || typeof body.source !== "string") {
    return new Response(
      JSON.stringify({ error: "source is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!body.name && !body.email && !body.phone) {
    return new Response(
      JSON.stringify({ error: "name, email or phone is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const normalized: NormalizedLead = {
    source: body.source,
    external_id: body.external_id ?? null,
    name: body.name?.trim() || "Lead sem nome",
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    campaign_id: body.campaign_id ?? null,
    campaign_name: body.campaign_name ?? null,
    adset_id: body.adset_id ?? null,
    adset_name: body.adset_name ?? null,
    ad_id: body.ad_id ?? null,
    ad_name: body.ad_name ?? null,
    form_id: body.form_id ?? null,
    form_name: body.form_name ?? null,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_content: body.utm_content ?? null,
    utm_term: body.utm_term ?? null,
    city: body.city ?? null,
    bairro: body.bairro ?? null,
    raw_payload: { body, extra: body.extra ?? {} },
  };

  const result = await ingestLead(supabase, normalized);

  const status = result.status === "failed" ? 500 : 200;
  return new Response(JSON.stringify(result), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
