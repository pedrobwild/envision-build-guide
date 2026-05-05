// Shared utilities for Digisac integration.
//
// - Carrega configuração (secret env var > tabela digisac_config como fallback).
// - Fetch autenticado com timeout.
// - Normalização de telefone/e-mail para matching com budgets.
// - Upsert de conversa e mensagem.
//
// Usado pelas edge functions digisac-webhook, digisac-sync e digisac-send.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

export const DIGISAC_PROVIDER = "digisac";
export const DIGISAC_DEFAULT_BASE_URL = "https://app.digisac.me/api/v1";
export const DIGISAC_TIMEOUT_MS = 20000;

// ------------------------------------------------------------
// Click-to-WhatsApp attribution marker
// ------------------------------------------------------------
// Quando um lead vem do anúncio do Meta para WhatsApp via Click-to-WhatsApp,
// configuramos a primeira mensagem para conter um marcador no formato:
//   [BW-<ad_id>-<adset_id>-<campaign_id>]
// Esse marcador permite atribuir o lead à campanha mesmo sem Lead Ads form.
//
// O regex é ESTRITO: aceita apenas dígitos para os três IDs e não consome
// caracteres adicionais. Use `parseBwMarker(text)` para extrair os IDs.
//
// Exemplos de match:
//   "Olá, vim do anúncio [BW-123-456-789]"
//   "[BW-1-2-3]"
// Não-match:
//   "[BW-abc-def-ghi]" (não-numéricos)
//   "[BW-1-2]"        (faltando IDs)
export const BW_MARKER_REGEX = /\[BW-(\d+)-(\d+)-(\d+)\]/;

export interface BwMarker {
  ad_id: string;
  adset_id: string;
  campaign_id: string;
}

export function parseBwMarker(text: string | null | undefined): BwMarker | null {
  if (!text) return null;
  const m = text.match(BW_MARKER_REGEX);
  if (!m) return null;
  return { ad_id: m[1], adset_id: m[2], campaign_id: m[3] };
}
export const DIGISAC_TIMEOUT_MS = 20000;

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export interface DigisacConfig {
  apiToken: string;
  apiBaseUrl: string;
  webhookSecret: string | null;
  defaultServiceId: string | null;
  defaultUserId: string | null;
  enabled: boolean;
}

export interface DigisacContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  tags?: unknown[];
  raw: Record<string, unknown>;
}

export interface DigisacTicket {
  id: string;
  contactId: string | null;
  channel: string | null;
  status: string | null;
  assignedUserName: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
}

export interface DigisacMessage {
  id: string;
  ticketId: string | null;
  contactId: string | null;
  direction: "in" | "out";
  authorName: string | null;
  body: string | null;
  messageType: string | null;
  status: string | null;
  replyToExternalId: string | null;
  attachments: unknown[];
  sentAt: string | null;
  raw: Record<string, unknown>;
}

export interface MatchedBudget {
  budgetId: string;
  matchedBy: "phone" | "email";
  matchedValue: string;
}

// ------------------------------------------------------------
// Supabase client (service role)
// ------------------------------------------------------------

export function makeServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ------------------------------------------------------------
// Config loader
// Prioridade: env vars > tabela digisac_config.
// ------------------------------------------------------------

export async function loadDigisacConfig(
  supabase: SupabaseClient,
): Promise<DigisacConfig> {
  const envToken = Deno.env.get("DIGISAC_API_TOKEN");
  const envBase = Deno.env.get("DIGISAC_API_BASE_URL");
  const envSecret = Deno.env.get("DIGISAC_WEBHOOK_SECRET");

  const { data: row } = await supabase
    .from("digisac_config")
    .select(
      "api_token, api_base_url, webhook_secret, default_service_id, default_user_id, enabled",
    )
    .eq("singleton", true)
    .maybeSingle();

  const apiToken = envToken || row?.api_token || "";
  const apiBaseUrl = (envBase || row?.api_base_url || DIGISAC_DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const webhookSecret = envSecret || row?.webhook_secret || null;
  const defaultServiceId = (row?.default_service_id as string | null) ?? null;
  const defaultUserId = (row?.default_user_id as string | null) ?? null;
  const enabled = row?.enabled !== false;

  return {
    apiToken,
    apiBaseUrl,
    webhookSecret,
    defaultServiceId,
    defaultUserId,
    enabled,
  };
}

// ------------------------------------------------------------
// HTTP helper: fetch with timeout + JSON parsing.
// ------------------------------------------------------------

export async function digisacFetch<T = unknown>(
  cfg: DigisacConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!cfg.apiToken) {
    throw new Error(
      "DIGISAC_API_TOKEN não configurado. Defina a secret ou preencha digisac_config.api_token.",
    );
  }
  const url = path.startsWith("http") ? path : `${cfg.apiBaseUrl}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DIGISAC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Digisac API ${res.status} (${path}): ${text.slice(0, 500)}`);
    }
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Digisac API (${path}) retornou JSON inválido: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Muitos endpoints do Digisac envelopam a resposta em `{ data }`, outros em
 * `{ tickets }`, `{ messages }`, `{ results }`, ou retornam array direto.
 * Este helper desembrulha de forma resiliente.
 */
export function unwrapList<T = unknown>(
  resp: unknown,
  keys: string[] = ["data", "results", "items", "tickets", "messages", "contacts"],
): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (!resp || typeof resp !== "object") return [];
  const r = resp as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

export function unwrapObject<T = Record<string, unknown>>(
  resp: unknown,
): T {
  if (!resp || typeof resp !== "object") return {} as T;
  const r = resp as Record<string, unknown>;
  if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
    return r.data as T;
  }
  return r as T;
}

// ------------------------------------------------------------
// Normalizers
// ------------------------------------------------------------

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  // Remove country code 55 (Brasil) para bater com client_phone nativo do sistema.
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const t = String(email).trim().toLowerCase();
  return t.includes("@") ? t : null;
}

export function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

// ------------------------------------------------------------
// Budget matching
//
// Regra do produto: aceitamos APENAS conversas vinculadas a um orçamento.
// 1) tentamos match por telefone (com e sem 55).
// 2) fallback: match por e-mail (lead_email).
// ------------------------------------------------------------

export async function findBudgetForContact(
  supabase: SupabaseClient,
  contact: { phone?: string | null; email?: string | null },
): Promise<MatchedBudget | null> {
  const phone = normalizePhone(contact.phone);
  const email = normalizeEmail(contact.email);

  if (phone) {
    const variants = [phone, `55${phone}`];
    const orFilter = variants.map((p) => `client_phone.eq.${p}`).join(",");
    const { data, error } = await supabase
      .from("budgets")
      .select("id, client_phone, created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) console.error("[digisac] phone match error:", error.message);
    if (data && data.length > 0) {
      return {
        budgetId: data[0].id as string,
        matchedBy: "phone",
        matchedValue: (data[0].client_phone as string) ?? phone,
      };
    }
  }

  if (email) {
    const { data, error } = await supabase
      .from("budgets")
      .select("id, lead_email, created_at")
      .ilike("lead_email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) console.error("[digisac] email match error:", error.message);
    if (data && data.length > 0) {
      return {
        budgetId: data[0].id as string,
        matchedBy: "email",
        matchedValue: (data[0].lead_email as string) ?? email,
      };
    }
  }

  return null;
}

// ------------------------------------------------------------
// Upserts
// ------------------------------------------------------------

export interface UpsertConversationInput {
  budgetId: string;
  externalId: string;
  channel: string | null;
  contactName: string | null;
  contactIdentifier: string | null;
  status: string | null;
  assignedUserName: string | null;
  avatarUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  providerData: Record<string, unknown>;
}

export async function upsertConversation(
  supabase: SupabaseClient,
  input: UpsertConversationInput,
): Promise<{ id: string }> {
  const nowIso = new Date().toISOString();
  const row = {
    budget_id: input.budgetId,
    provider: DIGISAC_PROVIDER,
    external_id: input.externalId,
    channel: input.channel,
    contact_name: input.contactName,
    contact_identifier: input.contactIdentifier,
    status: input.status,
    assigned_user_name: input.assignedUserName,
    avatar_url: input.avatarUrl,
    last_message_preview: input.lastMessagePreview,
    last_message_at: input.lastMessageAt,
    provider_data: input.providerData ?? {},
    updated_at: nowIso,
  };

  // Upsert atômico contra o índice único (provider, external_id).
  // Garante idempotência mesmo com webhooks reentregues em paralelo.
  const { data, error } = await supabase
    .from("budget_conversations")
    .upsert(
      { ...row, created_at: nowIso },
      { onConflict: "provider,external_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id as string };
}

export interface UpsertMessageInput {
  conversationId: string;
  externalId: string | null;
  direction: "in" | "out";
  authorName: string | null;
  body: string | null;
  messageType: string | null;
  status: string | null;
  replyToExternalId: string | null;
  attachments: unknown[];
  sentAt: string | null;
  providerData: Record<string, unknown>;
}

export async function upsertMessage(
  supabase: SupabaseClient,
  input: UpsertMessageInput,
): Promise<{ id: string; inserted: boolean }> {
  const row = {
    conversation_id: input.conversationId,
    external_id: input.externalId,
    direction: input.direction,
    author_name: input.authorName,
    body: input.body,
    message_type: input.messageType,
    status: input.status,
    reply_to_external_id: input.replyToExternalId,
    attachments: input.attachments ?? [],
    sent_at: input.sentAt,
    provider_data: input.providerData ?? {},
  };

  // Sem external_id não dá pra deduplicar — insere direto.
  if (!input.externalId) {
    const { data, error } = await supabase
      .from("budget_conversation_messages")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string, inserted: true };
  }

  // Upsert atômico contra o índice (conversation_id, external_id).
  // Detecta se foi insert ou update comparando created_at vs agora.
  const { data, error } = await supabase
    .from("budget_conversation_messages")
    .upsert(row, {
      onConflict: "conversation_id,external_id",
      ignoreDuplicates: false,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  // Se created_at foi nos últimos 2s, foi um INSERT real; caso contrário, UPDATE.
  const createdAt = new Date(String(data.created_at)).getTime();
  const inserted = !Number.isNaN(createdAt) && Date.now() - createdAt < 2000;

  return { id: data.id as string, inserted };
}

export async function upsertDigisacContact(
  supabase: SupabaseClient,
  contact: DigisacContact,
): Promise<void> {
  const row = {
    external_id: contact.id,
    name: contact.name ?? null,
    phone_raw: contact.phone ?? null,
    phone_normalized: normalizePhone(contact.phone ?? null),
    email: normalizeEmail(contact.email ?? null),
    avatar_url: contact.avatarUrl ?? null,
    tags: contact.tags ?? [],
    provider_data: contact.raw ?? {},
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("digisac_contacts")
    .select("id")
    .eq("external_id", contact.id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("digisac_contacts").update(row).eq("id", existing.id);
  } else {
    await supabase.from("digisac_contacts").insert(row);
  }
}

// ------------------------------------------------------------
// Parsers — traduzem a resposta do Digisac para os nossos tipos.
// Como a API do Digisac varia bastante por versão/conta, os parsers são
// tolerantes: tentam várias chaves comuns e fazem fallback para o objeto bruto.
// ------------------------------------------------------------

export function parseContact(raw: unknown): DigisacContact | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = pickString(r, ["id", "contactId", "contact_id"]);
  if (!id) return null;
  return {
    id,
    name: pickString(r, ["name", "fullName", "pushName"]),
    phone: pickString(r, ["number", "phone", "phoneNumber", "msisdn"]),
    email: pickString(r, ["email"]),
    avatarUrl: pickString(r, ["avatar", "avatarUrl", "pictureUrl", "photo"]),
    tags: pickArray(r, ["tags"]),
    raw: r,
  };
}

export function parseTicket(raw: unknown): DigisacTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = pickString(r, ["id", "ticketId", "ticket_id"]);
  if (!id) return null;
  const contactObj = (r.contact as Record<string, unknown> | undefined) ?? {};
  return {
    id,
    contactId:
      pickString(r, ["contactId", "contact_id"]) ??
      pickString(contactObj, ["id"]),
    channel: pickString(r, ["channel", "type", "source"]),
    status: pickString(r, ["status", "state"]),
    assignedUserName:
      pickString(r, ["assignedUserName", "userName"]) ??
      pickString(((r.user as Record<string, unknown>) ?? {}), ["name"]),
    updatedAt: pickString(r, ["updatedAt", "updated_at", "lastMessageAt"]),
    raw: r,
  };
}

export function parseMessage(raw: unknown): DigisacMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = pickString(r, ["id", "messageId", "message_id"]);
  if (!id) return null;

  const fromMe =
    r.fromMe === true ||
    r.isFromMe === true ||
    pickString(r, ["direction"])?.toLowerCase() === "out" ||
    pickString(r, ["origin"])?.toLowerCase() === "out";

  const attachments = pickArray(r, ["attachments", "media", "files"]);
  const fileUrl = pickString(r, ["fileUrl", "mediaUrl", "url"]);
  const mergedAttachments =
    attachments.length > 0
      ? attachments
      : fileUrl
      ? [{ url: fileUrl, type: pickString(r, ["mediaType", "type"]) }]
      : [];

  return {
    id,
    ticketId: pickString(r, ["ticketId", "ticket_id"]),
    contactId: pickString(r, ["contactId", "contact_id"]),
    direction: fromMe ? "out" : "in",
    authorName:
      pickString(r, ["authorName", "senderName", "userName"]) ??
      pickString(((r.user as Record<string, unknown>) ?? {}), ["name"]),
    body: pickString(r, ["text", "body", "message", "content"]),
    messageType: pickString(r, ["type", "messageType", "mediaType"]),
    status: pickString(r, ["status", "ack"]),
    replyToExternalId: pickString(r, ["replyToId", "quotedMessageId", "reply_to_id"]),
    attachments: mergedAttachments,
    sentAt: pickString(r, ["timestamp", "createdAt", "sentAt", "sent_at", "date"]),
    raw: r,
  };
}

// ------------------------------------------------------------
// API wrappers — endpoints usados pelo sync/send
// ------------------------------------------------------------

export async function fetchContact(
  cfg: DigisacConfig,
  contactId: string,
): Promise<DigisacContact | null> {
  const resp = await digisacFetch(cfg, `/contacts/${encodeURIComponent(contactId)}`);
  return parseContact(unwrapObject(resp));
}

export async function fetchTicket(
  cfg: DigisacConfig,
  ticketId: string,
): Promise<DigisacTicket | null> {
  const resp = await digisacFetch(cfg, `/tickets/${encodeURIComponent(ticketId)}`);
  return parseTicket(unwrapObject(resp));
}

export async function fetchTicketMessages(
  cfg: DigisacConfig,
  ticketId: string,
  limit = 50,
): Promise<DigisacMessage[]> {
  const resp = await digisacFetch(
    cfg,
    `/tickets/${encodeURIComponent(ticketId)}/messages?limit=${limit}`,
  );
  const items = unwrapList<Record<string, unknown>>(resp);
  return items.map(parseMessage).filter((m): m is DigisacMessage => m !== null);
}

export async function fetchRecentTickets(
  cfg: DigisacConfig,
  limit = 50,
): Promise<DigisacTicket[]> {
  const resp = await digisacFetch(cfg, `/tickets?limit=${limit}&order=desc`);
  const items = unwrapList<Record<string, unknown>>(resp);
  return items.map(parseTicket).filter((t): t is DigisacTicket => t !== null);
}

export interface SendMessagePayload {
  contactId: string;
  body?: string | null;
  attachmentUrl?: string | null;
  serviceId?: string | null;
  userId?: string | null;
  replyToId?: string | null;
}

export async function sendDigisacMessage(
  cfg: DigisacConfig,
  payload: SendMessagePayload,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    contactId: payload.contactId,
    text: payload.body ?? "",
  };
  if (payload.serviceId) body.serviceId = payload.serviceId;
  if (payload.userId) body.userId = payload.userId;
  if (payload.replyToId) body.replyMessageId = payload.replyToId;
  if (payload.attachmentUrl) body.fileUrl = payload.attachmentUrl;

  const resp = await digisacFetch(cfg, `/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return unwrapObject(resp);
}

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-digisac-signature, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
