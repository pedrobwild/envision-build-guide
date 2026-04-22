// Webhook público do Digisac. Digisac envia eventos de:
//   - message (mensagem recebida/enviada pelo operador)
//   - ticket.open / ticket.close
//   - contact.update
//
// Formato típico (pode variar por conta / versão):
// {
//   "event": "message.created",
//   "data": {
//     "id": "msg_abc",
//     "text": "Olá",
//     "type": "chat",
//     "timestamp": "2024-01-01T12:00:00Z",
//     "isFromMe": false,
//     "ticketId": "tkt_xyz",
//     "contactId": "ct_123",
//     "file": { "url": "...", "mimetype": "image/jpeg" }
//   }
// }
//
// A função é resiliente a variações desses nomes.

import {
  corsHeaders,
  loadDigisacConfig,
  getSupabaseAdmin,
  digisacRequest,
  upsertConversation,
  upsertMessage,
  upsertDigisacContact,
  normalizePhone,
  type DigisacConfig,
  type DigisacContact,
  type DigisacTicket,
  type DigisacMessage,
} from "../_shared/digisac.ts";

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const PROVIDER = "digisac";

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function pickBool(obj: Record<string, unknown>, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
  }
  return null;
}

async function enrichContact(
  cfg: DigisacConfig,
  contactId: string,
): Promise<DigisacContact | null> {
  try {
    const res = await digisacRequest<DigisacContact | { data: DigisacContact }>(
      cfg,
      `/contacts/${contactId}`,
    );
    const wrapper = res as { data?: DigisacContact };
    const c = wrapper?.data ?? (res as DigisacContact);
    return (c && typeof c === "object") ? c : null;
  } catch (e) {
    console.warn("[digisac-webhook] enrichContact failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function enrichTicket(
  cfg: DigisacConfig,
  ticketId: string,
): Promise<DigisacTicket | null> {
  try {
    const res = await digisacRequest<DigisacTicket | { data: DigisacTicket }>(
      cfg,
      `/tickets/${ticketId}?include=contact,user,service`,
    );
    const wrapper = res as { data?: DigisacTicket };
    const t = wrapper?.data ?? (res as DigisacTicket);
    return (t && typeof t === "object") ? t : null;
  } catch (e) {
    console.warn("[digisac-webhook] enrichTicket failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const cfg = await loadDigisacConfig(supabase);
  if (!cfg) {
    return new Response(
      JSON.stringify({
        error: "Digisac não configurado",
        hint: "Preencha digisac_config.api_token ou defina DIGISAC_API_TOKEN nos secrets.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Verificação opcional de secret.
  if (cfg.webhook_secret) {
    const url = new URL(req.url);
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-digisac-signature") ??
      req.headers.get("x-api-key") ??
      bearer ??
      url.searchParams.get("secret") ??
      url.searchParams.get("token") ??
      "";
    if (provided !== cfg.webhook_secret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — webhook secret inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[digisac-webhook] received:", JSON.stringify(body).slice(0, 800));

  const event = pickString(body, ["event", "type", "eventName"]) ?? "unknown";
  const data = (body.data ?? body.payload ?? body) as Record<string, unknown>;
  const looksLikeMessage =
    data && (data.text !== undefined || data.type !== undefined) && !!data.ticketId;

  try {
    if (event.startsWith("message") || looksLikeMessage) {
      await handleMessageEvent(supabase, cfg, data as unknown as DigisacMessage);
    } else if (event.startsWith("ticket")) {
      await handleTicketEvent(supabase, cfg, data as unknown as DigisacTicket);
    } else if (event.startsWith("contact")) {
      await upsertDigisacContact(supabase, data as unknown as DigisacContact);
    } else {
      console.warn("[digisac-webhook] unknown event:", event);
    }
  } catch (e) {
    console.error("[digisac-webhook] handler error:", e instanceof Error ? e.stack : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ success: true, event }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function handleMessageEvent(
  supabase: SupabaseAdminClient,
  cfg: DigisacConfig,
  msg: DigisacMessage,
) {
  const ticketId = (msg.ticketId ?? msg.ticket_id ?? null) as string | null;
  const contactId = (msg.contactId ?? msg.contact_id ?? null) as string | null;
  if (!ticketId) {
    console.warn("[digisac-webhook] mensagem sem ticketId — ignorando");
    return;
  }

  // Busca info extra do ticket e contato quando não vier no payload.
  let contact: DigisacContact | null = null;
  let ticket: DigisacTicket | null = null;
  if (contactId) contact = await enrichContact(cfg, contactId);
  ticket = await enrichTicket(cfg, ticketId);
  const ticketContact = (ticket?.contact ?? null) as DigisacContact | null;
  if (!contact && ticketContact) contact = ticketContact;

  if (contact) {
    await upsertDigisacContact(supabase, contact).catch((e) =>
      console.warn("[digisac-webhook] upsertDigisacContact:", e),
    );
  }

  const phone = normalizePhone(contact?.number ?? contact?.phoneNumber ?? null);
  const direction: "in" | "out" =
    pickBool(msg as Record<string, unknown>, ["fromMe", "isFromMe", "from_me"]) === true
      ? "out"
      : "in";

  const conversationId = await upsertConversation(supabase, {
    provider: PROVIDER,
    external_id: ticketId,
    channel: pickString((ticket ?? {}) as Record<string, unknown>, ["channel", "type"]) ?? "whatsapp",
    contact_name: contact?.name ?? null,
    contact_identifier: phone ?? contact?.email ?? contactId,
    contact_phone: phone,
    contact_email: contact?.email ?? null,
    avatar_url: contact?.avatar ?? null,
    status: ticket?.status ?? null,
    assigned_user_name: ticket?.user?.name ?? null,
    last_message_at: msg.timestamp ?? new Date().toISOString(),
    last_message_preview: msg.text ?? (msg.type ? `[${msg.type}]` : null),
    provider_data: { ticket, last_message_id: msg.id },
  });

  const attachments: unknown[] = [];
  if (msg.file && typeof msg.file === "object" && msg.file.url) {
    attachments.push({
      url: msg.file.url,
      name: msg.file.name ?? null,
      mimetype: msg.file.mimetype ?? null,
    });
  }

  await upsertMessage(supabase, {
    conversation_id: conversationId,
    external_id: msg.id,
    direction,
    author_name: direction === "out" ? (ticket?.user?.name ?? "Atendente") : (contact?.name ?? null),
    body: msg.text ?? null,
    message_type: msg.type ?? null,
    status: msg.status ?? null,
    sent_at: msg.timestamp ?? null,
    attachments,
    reply_to_external_id: msg.quotedMessageId ?? null,
    provider_data: msg as unknown as Record<string, unknown>,
  });
}

async function handleTicketEvent(
  supabase: SupabaseAdminClient,
  cfg: DigisacConfig,
  tk: DigisacTicket,
) {
  if (!tk?.id) return;
  let contact: DigisacContact | null = (tk.contact as DigisacContact) ?? null;
  if (!contact && tk.contactId) contact = await enrichContact(cfg, tk.contactId);
  if (contact) await upsertDigisacContact(supabase, contact);

  const phone = normalizePhone(contact?.number ?? contact?.phoneNumber ?? null);
  await upsertConversation(supabase, {
    provider: PROVIDER,
    external_id: tk.id,
    channel: pickString(tk as Record<string, unknown>, ["channel", "type"]) ?? "whatsapp",
    contact_name: contact?.name ?? null,
    contact_identifier: phone ?? contact?.email ?? (tk.contactId as string | null),
    contact_phone: phone,
    contact_email: contact?.email ?? null,
    avatar_url: contact?.avatar ?? null,
    status: tk.status ?? null,
    assigned_user_name: tk.user?.name ?? null,
    last_message_at: tk.lastMessageAt ?? tk.updatedAt ?? null,
    provider_data: { ticket: tk },
  });
}
