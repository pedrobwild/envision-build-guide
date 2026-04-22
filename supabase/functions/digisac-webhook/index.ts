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

// ----------------------------------------------------------------------------
// Verificação de segredo do webhook
// ----------------------------------------------------------------------------
// Suporta DOIS modos, nesta ordem de preferência:
//
//  1. HMAC-SHA256 (preferencial): o Digisac assina o corpo bruto com o segredo
//     compartilhado e envia o digest hex em um dos headers:
//       - x-digisac-signature: sha256=<hex>     (formato Meta/GitHub-like)
//       - x-hub-signature-256: sha256=<hex>
//       - x-signature-256:     sha256=<hex>
//     Validamos com `crypto.subtle` e comparação constant-time para evitar
//     timing attacks.
//
//  2. Token estático (legado / fallback): se nenhum header de assinatura veio,
//     aceitamos o segredo em claro via header (x-webhook-secret, x-api-key,
//     Authorization: Bearer) ou query string (?secret=, ?token=). Útil enquanto
//     o painel do Digisac não estiver configurado para assinar.
//
// Em qualquer falha, logamos APENAS metadados (modo tentado, header presente,
// length do digest, IP/UA truncados) — nunca o segredo nem o body.

type WebhookAuthResult =
  | { ok: true; mode: "hmac" | "static" | "disabled" }
  | { ok: false; reason: string; details: Record<string, unknown> };

const HMAC_HEADERS = [
  "x-digisac-signature",
  "x-hub-signature-256",
  "x-signature-256",
] as const;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractSignatureHeader(req: Request): { header: string; value: string } | null {
  for (const h of HMAC_HEADERS) {
    const v = req.headers.get(h);
    if (v && v.length > 0) return { header: h, value: v.trim() };
  }
  return null;
}

function parseSignatureValue(raw: string): string {
  // Aceita "sha256=abc...", "SHA256 abc..." ou apenas "abc..."
  const lower = raw.toLowerCase();
  if (lower.startsWith("sha256=")) return lower.slice(7);
  if (lower.startsWith("sha256 ")) return lower.slice(7).trim();
  return lower;
}

async function computeHmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractStaticSecret(req: Request): string | null {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const candidate =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-api-key") ??
    (bearer || null) ??
    url.searchParams.get("secret") ??
    url.searchParams.get("token");
  return candidate && candidate.length > 0 ? candidate : null;
}

function requestFingerprint(req: Request): Record<string, unknown> {
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    null;
  return {
    ip,
    ua: ua.slice(0, 80),
    has_auth: Boolean(req.headers.get("authorization")),
    sig_headers_present: HMAC_HEADERS.filter((h) => req.headers.get(h)),
  };
}

async function verifyWebhookAuth(
  req: Request,
  rawBody: string,
  expected: string | null,
): Promise<WebhookAuthResult> {
  if (!expected) {
    return { ok: true, mode: "disabled" };
  }

  const sigHeader = extractSignatureHeader(req);

  if (sigHeader) {
    const provided = parseSignatureValue(sigHeader.value);
    let computed: string;
    try {
      computed = await computeHmacSha256Hex(expected, rawBody);
    } catch (err) {
      return {
        ok: false,
        reason: "hmac_compute_failed",
        details: {
          mode: "hmac",
          header: sigHeader.header,
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }
    if (timingSafeEqualHex(provided, computed)) {
      return { ok: true, mode: "hmac" };
    }
    return {
      ok: false,
      reason: "hmac_mismatch",
      details: {
        mode: "hmac",
        header: sigHeader.header,
        provided_len: provided.length,
        expected_len: computed.length,
        body_bytes: rawBody.length,
      },
    };
  }

  // Fallback: token estático
  const staticSecret = extractStaticSecret(req);
  if (!staticSecret) {
    return {
      ok: false,
      reason: "missing_signature_and_token",
      details: { mode: "none" },
    };
  }
  if (
    staticSecret.length === expected.length &&
    timingSafeEqualHex(staticSecret, expected)
  ) {
    return { ok: true, mode: "static" };
  }
  return {
    ok: false,
    reason: "static_token_mismatch",
    details: { mode: "static", provided_len: staticSecret.length },
  };
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
