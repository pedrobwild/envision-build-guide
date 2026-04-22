// Webhook público chamado pelo Digisac em tempo real.
//
// Tipos de evento comuns (o nome do campo varia por versão; aceitamos várias):
//   - message / message.created / message.new        → nova mensagem
//   - message.status / message.ack                   → atualização de status
//   - ticket / ticket.updated / ticket.status        → atualização de ticket
//   - contact / contact.updated                      → atualização de contato
//
// Regra do produto: só persistimos conversa quando o contato bater com um
// orçamento (por telefone ou e-mail). Caso contrário, devolvemos 200
// `no_matching_budget` e logamos — o Digisac não deve ser retentado.

import {
  CORS_HEADERS,
  findBudgetForContact,
  jsonResponse,
  loadDigisacConfig,
  makeServiceClient,
  parseContact,
  parseMessage,
  parseTicket,
  pickString,
  fetchContact,
  fetchTicket,
  unwrapObject,
  upsertConversation,
  upsertDigisacContact,
  upsertMessage,
  type DigisacConfig,
  type DigisacContact,
  type DigisacMessage,
  type DigisacTicket,
} from "../_shared/digisac.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function verifySecret(req: Request, expected: string | null): boolean {
  if (!expected) return true; // secret opcional
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const provided =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-digisac-signature") ??
    req.headers.get("x-api-key") ??
    bearer ??
    url.searchParams.get("secret") ??
    url.searchParams.get("token") ??
    "";
  return provided === expected;
}

function extractEventType(body: Record<string, unknown>): string {
  return (
    pickString(body, ["event", "type", "eventType", "event_type"]) ??
    "unknown"
  );
}

function extractIds(body: Record<string, unknown>): {
  messageId: string | null;
  ticketId: string | null;
  contactId: string | null;
} {
  const payload = unwrapObject(body);
  // IDs podem estar no root ou aninhados em message/ticket/contact.
  const msg = (payload.message as Record<string, unknown>) ?? {};
  const tkt = (payload.ticket as Record<string, unknown>) ?? {};
  const ct = (payload.contact as Record<string, unknown>) ?? {};

  return {
    messageId:
      pickString(payload, ["messageId", "message_id"]) ??
      pickString(msg, ["id"]),
    ticketId:
      pickString(payload, ["ticketId", "ticket_id"]) ??
      pickString(tkt, ["id"]) ??
      pickString(msg, ["ticketId", "ticket_id"]),
    contactId:
      pickString(payload, ["contactId", "contact_id"]) ??
      pickString(ct, ["id"]) ??
      pickString(tkt, ["contactId", "contact_id"]) ??
      pickString(msg, ["contactId", "contact_id"]),
  };
}

/**
 * Dado um `contactId`, garante que temos:
 *  - o contato enriquecido (via API se o webhook veio com payload minimalista)
 *  - o budget vinculado (match por telefone/e-mail)
 */
async function resolveContactAndBudget(
  supabase: SupabaseClient,
  cfg: DigisacConfig,
  contactFromPayload: DigisacContact | null,
  contactId: string | null,
): Promise<
  | {
      contact: DigisacContact;
      budgetId: string;
      matched: { phone?: string | null; email?: string | null };
    }
  | null
> {
  let contact = contactFromPayload;
  if ((!contact || (!contact.phone && !contact.email)) && contactId) {
    try {
      contact = await fetchContact(cfg, contactId);
    } catch (err) {
      console.warn(
        `[digisac-webhook] falha buscando contato ${contactId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (!contact) return null;
  await upsertDigisacContact(supabase, contact);

  const match = await findBudgetForContact(supabase, {
    phone: contact.phone,
    email: contact.email,
  });
  if (!match) return null;

  return {
    contact,
    budgetId: match.budgetId,
    matched: { phone: contact.phone, email: contact.email },
  };
}

async function handleMessageEvent(
  supabase: SupabaseClient,
  cfg: DigisacConfig,
  payload: Record<string, unknown>,
  ids: { messageId: string | null; ticketId: string | null; contactId: string | null },
): Promise<Response> {
  const payloadObj = unwrapObject(payload);
  const rawMsg =
    (payloadObj.message as Record<string, unknown>) ??
    (payloadObj.data as Record<string, unknown>) ??
    payloadObj;

  const message: DigisacMessage | null = parseMessage(rawMsg);
  if (!message) {
    return jsonResponse(
      { success: false, reason: "no_message_in_payload", received_keys: Object.keys(payloadObj) },
      200,
    );
  }

  // Carrega/busca ticket se veio só o ID.
  let ticket: DigisacTicket | null =
    parseTicket((payloadObj.ticket as Record<string, unknown>) ?? {}) ?? null;
  const ticketId = message.ticketId ?? ids.ticketId ?? ticket?.id ?? null;
  if ((!ticket || (!ticket.channel && !ticket.status)) && ticketId) {
    try {
      ticket = await fetchTicket(cfg, ticketId);
    } catch (err) {
      console.warn(
        `[digisac-webhook] falha buscando ticket ${ticketId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const contactFromPayload: DigisacContact | null =
    parseContact((payloadObj.contact as Record<string, unknown>) ?? {}) ?? null;
  const contactId = message.contactId ?? ids.contactId ?? ticket?.contactId ?? null;

  const resolved = await resolveContactAndBudget(
    supabase,
    cfg,
    contactFromPayload,
    contactId,
  );
  if (!resolved) {
    console.warn(
      `[digisac-webhook] ignorando mensagem ${message.id}: contato sem orçamento vinculado (contactId=${contactId})`,
    );
    return jsonResponse(
      {
        success: false,
        reason: "no_matching_budget",
        hint:
          "Contato do Digisac não bateu com nenhum orçamento (por telefone ou e-mail). Mensagem ignorada.",
        message_id: message.id,
        contact_id: contactId,
      },
      200,
    );
  }

  const externalTicketId = ticketId ?? message.ticketId ?? `contact:${resolved.contact.id}`;

  const conv = await upsertConversation(supabase, {
    budgetId: resolved.budgetId,
    externalId: externalTicketId,
    channel: ticket?.channel ?? null,
    contactName: resolved.contact.name ?? null,
    contactIdentifier: resolved.contact.phone ?? resolved.contact.email ?? resolved.contact.id,
    status: ticket?.status ?? null,
    assignedUserName: ticket?.assignedUserName ?? null,
    avatarUrl: resolved.contact.avatarUrl ?? null,
    lastMessagePreview: (message.body ?? "").slice(0, 200),
    lastMessageAt: message.sentAt ?? new Date().toISOString(),
    providerData: {
      contact: resolved.contact.raw,
      ticket: ticket?.raw ?? null,
    },
  });

  const upserted = await upsertMessage(supabase, {
    conversationId: conv.id,
    externalId: message.id,
    direction: message.direction,
    authorName: message.authorName,
    body: message.body,
    messageType: message.messageType,
    status: message.status,
    replyToExternalId: message.replyToExternalId,
    attachments: message.attachments,
    sentAt: message.sentAt ?? new Date().toISOString(),
    providerData: message.raw,
  });

  return jsonResponse(
    {
      success: true,
      conversation_id: conv.id,
      message_id: upserted.id,
      inserted: upserted.inserted,
      budget_id: resolved.budgetId,
      matched_by: resolved.matched.phone ? "phone" : "email",
    },
    200,
  );
}

async function handleTicketEvent(
  supabase: SupabaseClient,
  cfg: DigisacConfig,
  payload: Record<string, unknown>,
  ids: { ticketId: string | null; contactId: string | null },
): Promise<Response> {
  const payloadObj = unwrapObject(payload);
  const rawTicket =
    (payloadObj.ticket as Record<string, unknown>) ??
    (payloadObj.data as Record<string, unknown>) ??
    payloadObj;

  let ticket: DigisacTicket | null = parseTicket(rawTicket);
  if (!ticket && ids.ticketId) {
    try {
      ticket = await fetchTicket(cfg, ids.ticketId);
    } catch {
      /* ignore */
    }
  }
  if (!ticket) {
    return jsonResponse(
      { success: false, reason: "no_ticket_in_payload" },
      200,
    );
  }

  const contactFromPayload: DigisacContact | null =
    parseContact((payloadObj.contact as Record<string, unknown>) ?? {}) ?? null;
  const contactId = ticket.contactId ?? ids.contactId ?? null;

  const resolved = await resolveContactAndBudget(supabase, cfg, contactFromPayload, contactId);
  if (!resolved) {
    return jsonResponse(
      {
        success: false,
        reason: "no_matching_budget",
        ticket_id: ticket.id,
        contact_id: contactId,
      },
      200,
    );
  }

  const conv = await upsertConversation(supabase, {
    budgetId: resolved.budgetId,
    externalId: ticket.id,
    channel: ticket.channel,
    contactName: resolved.contact.name ?? null,
    contactIdentifier: resolved.contact.phone ?? resolved.contact.email ?? resolved.contact.id,
    status: ticket.status,
    assignedUserName: ticket.assignedUserName,
    avatarUrl: resolved.contact.avatarUrl ?? null,
    lastMessagePreview: null,
    lastMessageAt: ticket.updatedAt ?? new Date().toISOString(),
    providerData: {
      contact: resolved.contact.raw,
      ticket: ticket.raw,
    },
  });

  return jsonResponse(
    {
      success: true,
      conversation_id: conv.id,
      ticket_id: ticket.id,
      budget_id: resolved.budgetId,
    },
    200,
  );
}

async function handleContactEvent(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<Response> {
  const payloadObj = unwrapObject(payload);
  const rawContact =
    (payloadObj.contact as Record<string, unknown>) ??
    (payloadObj.data as Record<string, unknown>) ??
    payloadObj;
  const contact = parseContact(rawContact);
  if (!contact) {
    return jsonResponse({ success: false, reason: "no_contact_in_payload" }, 200);
  }
  await upsertDigisacContact(supabase, contact);
  return jsonResponse({ success: true, contact_id: contact.id }, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = makeServiceClient();
  const cfg = await loadDigisacConfig(supabase);

  if (!cfg.enabled) {
    return jsonResponse({ success: false, reason: "integration_disabled" }, 200);
  }

  if (!verifySecret(req, cfg.webhookSecret)) {
    console.warn("[digisac-webhook] webhook secret inválido ou ausente");
    return jsonResponse(
      {
        error: "Unauthorized",
        hint:
          "Webhook secret inválido. Envie via header x-webhook-secret, x-digisac-signature, x-api-key ou Authorization: Bearer <secret>, ou via query ?secret=<secret>.",
      },
      401,
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const eventType = extractEventType(body).toLowerCase();
  const ids = extractIds(body);

  console.log(
    `[digisac-webhook] event=${eventType} ids=${JSON.stringify(ids)}`,
  );

  try {
    if (eventType.includes("message")) {
      return await handleMessageEvent(supabase, cfg, body, ids);
    }
    if (eventType.includes("ticket")) {
      return await handleTicketEvent(supabase, cfg, body, ids);
    }
    if (eventType.includes("contact")) {
      return await handleContactEvent(supabase, body);
    }
    // Evento desconhecido → tenta inferir pelo payload
    if (ids.messageId) {
      return await handleMessageEvent(supabase, cfg, body, ids);
    }
    if (ids.ticketId) {
      return await handleTicketEvent(supabase, cfg, body, ids);
    }
    if (ids.contactId) {
      return await handleContactEvent(supabase, body);
    }
    return jsonResponse(
      { success: false, reason: "unknown_event", event: eventType },
      200,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digisac-webhook] erro processando evento:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
