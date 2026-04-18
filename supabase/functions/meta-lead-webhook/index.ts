/**
 * Meta Lead Ads Webhook
 *
 * INFRAESTRUTURA preparada para receber leads do Facebook/Instagram Lead Ads.
 *
 * Fluxo:
 *  1. Meta envia GET com `hub.challenge` para verificação inicial.
 *  2. Meta envia POST com payload `{ object: 'page', entry: [...] }` para cada novo lead.
 *  3. Validamos a assinatura HMAC-SHA256 (header `x-hub-signature-256`) usando META_APP_SECRET.
 *  4. Para cada lead chamamos o pipeline `ingestLead` (helpers compartilhados):
 *     - Persiste payload bruto em `lead_sources`
 *     - Upsert em `clients` (dedup por external_id, email ou telefone normalizado)
 *     - Resolve owner via `resolve_lead_owner` (routing rules)
 *     - Trigger `create_mql_budget_for_new_client` cria orçamento MQL automaticamente
 *     - Trigger `notify_owner_on_new_lead` notifica o responsável
 *
 * Segredos necessários para ativação:
 *  - META_APP_SECRET           → assinatura HMAC dos webhooks
 *  - META_VERIFY_TOKEN         → string usada na verificação inicial
 *  - META_PAGE_ACCESS_TOKEN    → para enriquecer o lead via Graph API
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ingestLead, type NormalizedLead } from "../_shared/lead-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface MetaLeadFieldData {
  name: string;
  values: string[];
}

interface MetaLeadFull {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  field_data?: MetaLeadFieldData[];
}

interface MetaWebhookChange {
  field: string;
  value: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;
    created_time?: number;
  };
}

interface MetaWebhookEntry {
  id: string;
  time: number;
  changes?: MetaWebhookChange[];
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

function getEnv(name: string): string | null {
  const v = Deno.env.get(name);
  return v && v.length > 0 ? v : null;
}

async function verifySignature(
  body: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const expected = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === expected;
}

function fieldDataToObject(fields: MetaLeadFieldData[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields ?? []) {
    out[f.name] = (f.values?.[0] ?? "").trim();
  }
  return out;
}

async function fetchLeadFromGraphApi(
  leadgenId: string,
  pageAccessToken: string,
): Promise<MetaLeadFull | null> {
  const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data&access_token=${pageAccessToken}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`[meta-webhook] Graph API error ${resp.status}:`, await resp.text());
    return null;
  }
  return (await resp.json()) as MetaLeadFull;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Supabase env not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ---------- Verificação inicial (GET) ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = getEnv("META_VERIFY_TOKEN");
    if (!verifyToken) {
      return new Response("Meta integration not configured yet", {
        status: 503,
        headers: corsHeaders,
      });
    }
    if (mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const appSecret = getEnv("META_APP_SECRET");
  const pageAccessToken = getEnv("META_PAGE_ACCESS_TOKEN");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (appSecret) {
    const ok = await verifySignature(
      rawBody,
      req.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!ok) {
      console.warn("[meta-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }
  } else {
    console.warn("[meta-webhook] META_APP_SECRET not configured — skipping signature check");
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  if (!payload.entry || payload.entry.length === 0) {
    console.warn("[meta-webhook] Empty entry array, payload:", JSON.stringify(payload).slice(0, 500));
    return new Response(JSON.stringify({ success: true, results: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ leadgen_id: string; status: string; error?: string }> = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      // Enriquece via Graph API se token disponível
      let leadFull: MetaLeadFull | null = null;
      if (pageAccessToken) {
        leadFull = await fetchLeadFromGraphApi(leadgenId, pageAccessToken);
      }

      const fields = fieldDataToObject(leadFull?.field_data);
      const fullName =
        fields["full_name"] ||
        [fields["first_name"], fields["last_name"]].filter(Boolean).join(" ") ||
        fields["name"] ||
        "Lead Meta";

      const normalized: NormalizedLead = {
        source: "meta_ads",
        external_id: leadgenId,
        name: fullName,
        email: fields["email"] || null,
        phone: fields["phone_number"] || fields["phone"] || null,
        campaign_id: leadFull?.campaign_id ?? null,
        campaign_name: leadFull?.campaign_name ?? null,
        adset_id: leadFull?.adset_id ?? null,
        adset_name: leadFull?.adset_name ?? null,
        ad_id: leadFull?.ad_id ?? change.value.ad_id ?? null,
        ad_name: leadFull?.ad_name ?? null,
        form_id: leadFull?.form_id ?? change.value.form_id ?? null,
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: leadFull?.campaign_name ?? leadFull?.campaign_id ?? null,
        city: fields["city"] || null,
        raw_payload: { entry, change, lead_full: leadFull, fields },
      };

      // Se não temos token de página, ainda registramos o payload bruto
      if (!pageAccessToken || !leadFull) {
        try {
          const { persistRawLead } = await import("../_shared/lead-ingest.ts");
          await persistRawLead(supabase, normalized);
          results.push({ leadgen_id: leadgenId, status: "captured_pending_enrichment" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown";
          results.push({ leadgen_id: leadgenId, status: "failed", error: msg });
        }
        continue;
      }

      const result = await ingestLead(supabase, normalized);
      results.push({ leadgen_id: leadgenId, status: result.status, error: result.error });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
