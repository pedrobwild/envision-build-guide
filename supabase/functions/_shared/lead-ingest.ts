/**
 * Helpers compartilhados para ingestão de leads externos.
 *
 * Centralizam a lógica de:
 *  - Persistir o payload bruto em `lead_sources` (auditoria)
 *  - Resolver dono via `resolve_lead_owner`
 *  - Fazer upsert do cliente (com dedup por email/telefone normalizado)
 *  - Marcar o lead como processado
 *
 * Usado por edge functions de webhook (meta-lead-webhook, lead-webhook,
 * google-ads-webhook futuramente, etc.).
 */

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface NormalizedLead {
  source: string;                       // 'meta_ads', 'google_ads', 'site_form', etc.
  external_id: string | null;           // ID único na origem (ex: leadgen_id do Meta)
  name: string;
  email: string | null;
  phone: string | null;
  // Tracking
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
  // Captura (planilhas Meta / Google Sheets)
  lead_captured_at?: string | null;     // ISO timestamp da geração na origem
  platform?: string | null;             // ex: 'fb', 'ig', 'an', 'msg' ou rótulo livre
  // Payload bruto para auditoria
  raw_payload: Record<string, unknown>;
}

export interface IngestResult {
  status: "processed" | "duplicate" | "captured_pending" | "failed";
  client_id?: string;
  lead_source_id?: string;
  error?: string;
}

/** Normaliza telefone para apenas dígitos, removendo DDI BR. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Persiste o lead bruto em lead_sources (idempotente via unique index).
 * Retorna o lead_source.id e se já estava processado.
 */
export async function persistRawLead(
  supabase: SupabaseClient,
  lead: NormalizedLead,
): Promise<{ id: string; alreadyProcessed: boolean }> {
  // Verifica se já foi processado
  if (lead.external_id) {
    const { data: existing } = await supabase
      .from("lead_sources")
      .select("id, processing_status")
      .eq("source", lead.source)
      .eq("external_id", lead.external_id)
      .maybeSingle();

    if (existing?.processing_status === "processed") {
      return { id: existing.id, alreadyProcessed: true };
    }
  }

  const row = {
    source: lead.source,
    external_id: lead.external_id,
    form_id: lead.form_id ?? null,
    form_name: lead.form_name ?? null,
    campaign_id: lead.campaign_id ?? null,
    campaign_name: lead.campaign_name ?? null,
    adset_id: lead.adset_id ?? null,
    adset_name: lead.adset_name ?? null,
    ad_id: lead.ad_id ?? null,
    ad_name: lead.ad_name ?? null,
    lead_captured_at: lead.lead_captured_at ?? null,
    platform: lead.platform ?? null,
    raw_payload: lead.raw_payload,
    processing_status: "pending",
  };

  const { data, error } = await supabase
    .from("lead_sources")
    .upsert(row, { onConflict: "source,external_id" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, alreadyProcessed: false };
}

/**
 * Faz upsert do cliente, dedup por (external_source, external_lead_id),
 * email (case-insensitive) ou phone normalizado.
 * Resolve owner via resolve_lead_owner se cliente novo.
 */
export async function upsertClientFromLead(
  supabase: SupabaseClient,
  lead: NormalizedLead,
): Promise<string> {
  const phoneNorm = normalizePhone(lead.phone);

  // 1. Dedup por external_source + external_lead_id
  let existingId: string | null = null;
  if (lead.external_id) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("external_source", lead.source)
      .eq("external_lead_id", lead.external_id)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  // 2. Dedup por email
  if (!existingId && lead.email) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", lead.email)
      .eq("is_active", true)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  // 3. Dedup por telefone normalizado
  if (!existingId && phoneNorm) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("phone_normalized", phoneNorm)
      .eq("is_active", true)
      .maybeSingle();
    existingId = data?.id ?? null;
  }

  if (existingId) {
    // Apenas atualiza tracking se faltar
    const patch: Record<string, unknown> = {
      external_source: lead.source,
      external_lead_id: lead.external_id,
      campaign_id: lead.campaign_id,
      campaign_name: lead.campaign_name,
      adset_id: lead.adset_id,
      adset_name: lead.adset_name,
      ad_id: lead.ad_id,
      ad_name: lead.ad_name,
      form_id: lead.form_id,
      form_name: lead.form_name,
      utm_source: lead.utm_source ?? lead.source.replace("_ads", ""),
      utm_medium: lead.utm_medium ?? "paid_social",
      utm_campaign: lead.utm_campaign ?? lead.campaign_name,
      lead_captured_at: lead.lead_captured_at,
      platform: lead.platform,
      external_lead_payload: lead.raw_payload,
    };
    // Remove undefined
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    const { error } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  // 4. Resolve owner via routing rules
  let ownerId: string | null = null;
  try {
    const { data: ownerResult } = await supabase.rpc("resolve_lead_owner", {
      p_source: lead.source,
      p_campaign_id: lead.campaign_id ?? null,
      p_campaign_name: lead.campaign_name ?? null,
      p_form_id: lead.form_id ?? null,
      p_city: lead.city ?? null,
    });
    ownerId = (ownerResult as string | null) ?? null;
  } catch (err) {
    console.warn("[lead-ingest] resolve_lead_owner failed:", err);
  }

  // 5. Insert
  const insertPayload = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: "lead",
    source: lead.source,
    external_source: lead.source,
    external_lead_id: lead.external_id,
    external_lead_payload: lead.raw_payload,
    commercial_owner_id: ownerId,
    campaign_id: lead.campaign_id ?? null,
    campaign_name: lead.campaign_name ?? null,
    adset_id: lead.adset_id ?? null,
    adset_name: lead.adset_name ?? null,
    ad_id: lead.ad_id ?? null,
    ad_name: lead.ad_name ?? null,
    form_id: lead.form_id ?? null,
    form_name: lead.form_name ?? null,
    city: lead.city ?? null,
    bairro: lead.bairro ?? null,
    utm_source: lead.utm_source ?? lead.source.replace("_ads", ""),
    utm_medium: lead.utm_medium ?? (lead.source.endsWith("_ads") ? "paid_social" : "referral"),
    utm_campaign: lead.utm_campaign ?? lead.campaign_name ?? lead.campaign_id ?? null,
    utm_content: lead.utm_content ?? null,
    utm_term: lead.utm_term ?? null,
    lead_captured_at: lead.lead_captured_at ?? null,
    platform: lead.platform ?? null,
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Marca um lead_source como processado e linka client_id. */
export async function markLeadProcessed(
  supabase: SupabaseClient,
  leadSourceId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("lead_sources")
    .update({
      client_id: clientId,
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", leadSourceId);
  if (error) throw error;
}

/** Marca um lead_source como falhado, salva o erro. */
export async function markLeadFailed(
  supabase: SupabaseClient,
  leadSourceId: string,
  error: string,
): Promise<void> {
  await supabase
    .from("lead_sources")
    .update({
      processing_status: "failed",
      processing_error: error.slice(0, 500),
      processed_at: new Date().toISOString(),
    })
    .eq("id", leadSourceId);
}

/** Pipeline completo: persiste, faz upsert do cliente, marca processado. */
export async function ingestLead(
  supabase: SupabaseClient,
  lead: NormalizedLead,
): Promise<IngestResult> {
  let leadSourceId: string | undefined;
  try {
    const { id, alreadyProcessed } = await persistRawLead(supabase, lead);
    leadSourceId = id;
    if (alreadyProcessed) {
      return { status: "duplicate", lead_source_id: id };
    }
    const clientId = await upsertClientFromLead(supabase, lead);
    await markLeadProcessed(supabase, id, clientId);
    return { status: "processed", client_id: clientId, lead_source_id: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[lead-ingest] failed:", message);
    if (leadSourceId) {
      await markLeadFailed(supabase, leadSourceId, message);
    }
    return { status: "failed", error: message, lead_source_id: leadSourceId };
  }
}
