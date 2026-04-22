// Cliente e utilitários compartilhados para integração com Digisac.
// Digisac é uma plataforma brasileira de atendimento omnichannel (WhatsApp,
// Instagram, Facebook, etc). Documentação pública: https://app.digisac.biz/api/v1
//
// Convenções:
//   - O token pode vir do secret DIGISAC_API_TOKEN (edge function) OU da
//     tabela digisac_config (service_role). O secret tem prioridade.
//   - Normalizamos telefones para dígitos puros, removendo prefixo 55 (Brasil)
//     para facilitar matches com client_phone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-digisac-signature, x-webhook-secret",
};

export interface DigisacConfig {
  api_base_url: string;
  api_token: string;
  webhook_secret: string | null;
  default_service_id: string | null;
  default_user_id: string | null;
}

export interface DigisacMessage {
  id: string;
  text?: string | null;
  type?: string | null;
  timestamp?: string | null;
  fromMe?: boolean;
  isFromMe?: boolean;
  ticketId?: string | null;
  contactId?: string | null;
  userId?: string | null;
  status?: string | null;
  file?: { url?: string; name?: string; mimetype?: string } | null;
  quotedMessageId?: string | null;
  [key: string]: unknown;
}

export interface DigisacContact {
  id: string;
  name?: string | null;
  number?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  avatar?: string | null;
  [key: string]: unknown;
}

export interface DigisacTicket {
  id: string;
  contactId?: string | null;
  userId?: string | null;
  serviceId?: string | null;
  status?: string | null;
  lastMessageId?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  contact?: DigisacContact | null;
  user?: { id: string; name?: string } | null;
  [key: string]: unknown;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

export type SupabaseLike = ReturnType<typeof createClient>;

export async function loadDigisacConfig(supabase: SupabaseLike): Promise<DigisacConfig | null> {
  const envToken = Deno.env.get("DIGISAC_API_TOKEN");
  const envBase = Deno.env.get("DIGISAC_API_BASE_URL");
  const envWebhook = Deno.env.get("DIGISAC_WEBHOOK_SECRET");

  const { data } = await supabase
    .from("digisac_config")
    .select("api_base_url, api_token, webhook_secret, default_service_id, default_user_id, enabled")
    .limit(1)
    .maybeSingle();

  const token = envToken ?? data?.api_token ?? null;
  const base = envBase ?? data?.api_base_url ?? "https://app.digisac.biz/api/v1";
  const webhook = envWebhook ?? data?.webhook_secret ?? null;

  if (!token) return null;
  if (data && data.enabled === false && !envToken) return null;

  return {
    api_base_url: base.replace(/\/$/, ""),
    api_token: token,
    webhook_secret: webhook,
    default_service_id: data?.default_service_id ?? null,
    default_user_id: data?.default_user_id ?? null,
  };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function digisacRequest<T = unknown>(
  cfg: DigisacConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${cfg.api_base_url}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetchWithTimeout(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.api_token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Digisac API ${res.status}: ${text.slice(0, 500)}`);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// Procura o budget mais provável para um contato do Digisac.
// Estratégia: telefone > e-mail. Retorna null se nada bater.
export async function findBudgetIdForContact(
  supabase: SupabaseLike,
  contact: { phone?: string | null; email?: string | null },
): Promise<string | null> {
  const phone = normalizePhone(contact.phone);
  if (phone) {
    const variants = [phone, `55${phone}`];
    const orFilter = variants.map((p) => `client_phone.eq.${p}`).join(",");
    const { data } = await supabase
      .from("budgets")
      .select("id, created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }

  if (contact.email) {
    const email = contact.email.trim().toLowerCase();
    const { data } = await supabase
      .from("budgets")
      .select("id, created_at")
      .ilike("lead_email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }

  return null;
}

export interface UpsertConversationInput {
  provider: string;
  external_id: string;
  channel?: string | null;
  contact_name?: string | null;
  contact_identifier?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  avatar_url?: string | null;
  status?: string | null;
  assigned_user_name?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  provider_data?: Record<string, unknown>;
}

// Retorna o id da budget_conversation (criando se necessário).
export async function upsertConversation(
  supabase: SupabaseLike,
  input: UpsertConversationInput,
): Promise<string> {
  const budgetId = await findBudgetIdForContact(supabase, {
    phone: input.contact_phone,
    email: input.contact_email,
  });

  const { data: existing } = await supabase
    .from("budget_conversations")
    .select("id, budget_id")
    .eq("provider", input.provider)
    .eq("external_id", input.external_id)
    .maybeSingle();

  const row = {
    provider: input.provider,
    external_id: input.external_id,
    channel: input.channel ?? "whatsapp",
    contact_name: input.contact_name ?? null,
    contact_identifier: input.contact_identifier ?? input.contact_phone ?? null,
    avatar_url: input.avatar_url ?? null,
    status: input.status ?? null,
    assigned_user_name: input.assigned_user_name ?? null,
    last_message_at: input.last_message_at ?? null,
    last_message_preview: input.last_message_preview?.slice(0, 500) ?? null,
    provider_data: input.provider_data ?? {},
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    // Só sobrescreve budget_id se atualmente estiver vazio e tivermos um match.
    const toUpdate: Record<string, unknown> = { ...row };
    if (!existing.budget_id && budgetId) toUpdate.budget_id = budgetId;
    await supabase.from("budget_conversations").update(toUpdate).eq("id", existing.id);
    return existing.id as string;
  }

  const { data: inserted, error } = await supabase
    .from("budget_conversations")
    .insert({ ...row, budget_id: budgetId })
    .select("id")
    .single();
  if (error) throw new Error(`upsertConversation: ${error.message}`);
  return inserted.id as string;
}

export interface UpsertMessageInput {
  conversation_id: string;
  external_id?: string | null;
  direction: "in" | "out";
  author_name?: string | null;
  body?: string | null;
  message_type?: string | null;
  status?: string | null;
  sent_at?: string | null;
  attachments?: unknown[];
  reply_to_external_id?: string | null;
  provider_data?: Record<string, unknown>;
}

export async function upsertMessage(
  supabase: SupabaseLike,
  input: UpsertMessageInput,
): Promise<void> {
  if (input.external_id) {
    const { data: existing } = await supabase
      .from("budget_conversation_messages")
      .select("id")
      .eq("conversation_id", input.conversation_id)
      .eq("external_id", input.external_id)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from("budget_conversation_messages")
        .update({
          status: input.status ?? null,
          body: input.body ?? null,
          provider_data: input.provider_data ?? {},
        })
        .eq("id", existing.id);
      return;
    }
  }

  const { error } = await supabase.from("budget_conversation_messages").insert({
    conversation_id: input.conversation_id,
    external_id: input.external_id ?? null,
    direction: input.direction,
    author_name: input.author_name ?? null,
    body: input.body ?? null,
    message_type: input.message_type ?? null,
    status: input.status ?? null,
    sent_at: input.sent_at ?? new Date().toISOString(),
    attachments: input.attachments ?? [],
    reply_to_external_id: input.reply_to_external_id ?? null,
    provider_data: input.provider_data ?? {},
  });
  if (error) throw new Error(`upsertMessage: ${error.message}`);
}

export async function upsertDigisacContact(
  supabase: SupabaseLike,
  contact: DigisacContact,
): Promise<void> {
  const phone = normalizePhone(contact.number ?? contact.phoneNumber ?? null);
  const row = {
    external_id: contact.id,
    name: contact.name ?? null,
    phone,
    email: contact.email ?? null,
    avatar_url: contact.avatar ?? null,
    raw: contact as unknown,
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

export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}
