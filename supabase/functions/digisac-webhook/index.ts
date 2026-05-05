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
  parseBwMarker,
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
  type BwMarker,
  type DigisacConfig,
  type DigisacContact,
  type DigisacMessage,
  type DigisacTicket,
} from "../_shared/digisac.ts";
import { ingestLead, type NormalizedLead } from "../_shared/lead-ingest.ts";
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

// ----------------------------------------------------------------------------
// Idempotência por evento
// ----------------------------------------------------------------------------
// Computamos uma `event_key` estável a partir do corpo bruto + IDs principais
// (messageId/ticketId/contactId), e tentamos INSERT em `digisac_webhook_events`.
// Se o índice único disparar conflito, sabemos que esse evento já foi processado
// e devolvemos o resultado anterior — sem tocar em conversas/mensagens.

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function computeEventKey(
  rawBody: string,
  eventType: string,
  ids: { messageId: string | null; ticketId: string | null; contactId: string | null },
): Promise<string> {
  // Inclui IDs no preimage para que payloads idênticos com IDs distintos
  // não colidam (ex.: dois acks idênticos de mensagens diferentes).
  const preimage = JSON.stringify({
    e: eventType,
    m: ids.messageId,
    t: ids.ticketId,
    c: ids.contactId,
    b: rawBody,
  });
  return await sha256Hex(preimage);
}

interface WebhookEventDedupResult {
  duplicate: boolean;
  cachedResult?: Record<string, unknown> | null;
}

async function checkAndReserveEvent(
  supabase: SupabaseClient,
  eventKey: string,
  eventType: string,
  ids: { messageId: string | null; ticketId: string | null; contactId: string | null },
): Promise<WebhookEventDedupResult> {
  const { error } = await supabase.from("digisac_webhook_events").insert({
    event_key: eventKey,
    event_type: eventType,
    external_message_id: ids.messageId,
    external_ticket_id: ids.ticketId,
    external_contact_id: ids.contactId,
  });

  if (!error) return { duplicate: false };

  // 23505 = unique_violation no Postgres.
  const code = (error as { code?: string }).code ?? "";
  if (code === "23505") {
    const { data } = await supabase
      .from("digisac_webhook_events")
      .select("result")
      .eq("event_key", eventKey)
      .maybeSingle();
    return {
      duplicate: true,
      cachedResult: (data?.result as Record<string, unknown>) ?? null,
    };
  }

  // Falha não relacionada a duplicidade — registra e segue (não bloqueia processamento).
  console.warn(
    "[digisac-webhook] failed to reserve event",
    JSON.stringify({ code, message: (error as { message?: string }).message ?? String(error) }),
  );
  return { duplicate: false };
}

async function recordEventResult(
  supabase: SupabaseClient,
  eventKey: string,
  result: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("digisac_webhook_events")
    .update({ result })
    .eq("event_key", eventKey);
  if (error) {
    console.warn(
      "[digisac-webhook] failed to record event result",
      JSON.stringify({ message: error.message }),
    );
  }
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

// ----------------------------------------------------------------------------
// Cenário A: criar cliente novo a partir de marcador BW (Click-to-WhatsApp)
// ----------------------------------------------------------------------------
// Quando um contato desconhecido manda a primeira mensagem contendo
// "[BW-<ad_id>-<adset_id>-<campaign_id>]", criamos o cliente via `ingestLead`
// (que já dedup por phone_normalized graças ao UNIQUE recém-criado e trata
// 23505 como cliente existente) e devolvemos o contato para re-resolver budget.
async function tryIngestFromBwMarker(
  supabase: SupabaseClient,
  cfg: DigisacConfig,
  contactFromPayload: DigisacContact | null,
  contactId: string | null,
  marker: BwMarker,
  messageId: string,
): Promise<{ contact: DigisacContact; clientId: string } | null> {
  // Garante que temos o contato hidratado (com telefone/nome).
  let contact = contactFromPayload;
  if ((!contact || (!contact.phone && !contact.email)) && contactId) {
    try {
      contact = await fetchContact(cfg, contactId);
    } catch (err) {
      console.warn(JSON.stringify({
        tag: "[digisac-webhook]",
        event: "fetch_contact_failed_during_bw",
        contactId,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }
  if (!contact) return null;
  await upsertDigisacContact(supabase, contact);

  // Sem telefone E sem email não temos como criar cliente útil.
  if (!contact.phone && !contact.email) return null;

  const lead: NormalizedLead = {
    source: "meta_ads",
    external_id: `digisac:${messageId}`,
    name: contact.name || "Lead WhatsApp",
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    ad_id: marker.ad_id,
    adset_id: marker.adset_id,
    campaign_id: marker.campaign_id,
    utm_source: "meta",
    utm_medium: "click_to_whatsapp",
    utm_campaign: marker.campaign_id,
    raw_payload: {
      origin: "digisac_webhook_bw_marker",
      digisac_message_id: messageId,
      digisac_contact_id: contact.id,
      marker,
    },
  };

  const result = await ingestLead(supabase, lead);
  if (result.status === "failed" || !result.client_id) {
    return null;
  }
  return { contact, clientId: result.client_id };
}

// Preenche colunas de tracking em budget existente quando estiverem vazias.
// Não sobrescreve dados já presentes (atribuição original do lead vence).
async function backfillBudgetAttribution(
  supabase: SupabaseClient,
  budgetId: string,
  marker: BwMarker,
): Promise<void> {
  try {
    const { data: b } = await supabase
      .from("budgets")
      .select("ad_id, adset_id, campaign_id, utm_source")
      .eq("id", budgetId)
      .maybeSingle();
    if (!b) return;
    const patch: Record<string, string> = {};
    if (!b.ad_id) patch.ad_id = marker.ad_id;
    if (!b.adset_id) patch.adset_id = marker.adset_id;
    if (!b.campaign_id) patch.campaign_id = marker.campaign_id;
    if (!b.utm_source) patch.utm_source = "meta";
    if (Object.keys(patch).length === 0) return;
    await supabase.from("budgets").update(patch).eq("id", budgetId);
  } catch (err) {
    console.warn(JSON.stringify({
      tag: "[digisac-webhook]",
      event: "backfill_attribution_failed",
      budgetId,
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}


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

  let resolved = await resolveContactAndBudget(
    supabase,
    cfg,
    contactFromPayload,
    contactId,
  );

  // ---------- Cenário A: contato desconhecido + marcador BW na mensagem ----------
  // Click-to-WhatsApp pode trazer um contato que ainda não existe como cliente.
  // Se a primeira mensagem traz "[BW-<ad_id>-<adset_id>-<campaign_id>]", criamos
  // o cliente (e o budget MQL é gerado pelo trigger) e re-resolvemos.
  if (!resolved && message.direction === "in") {
    const marker = parseBwMarker(message.body);
    if (marker) {
      try {
        const ingested = await tryIngestFromBwMarker(
          supabase,
          cfg,
          contactFromPayload,
          contactId,
          marker,
          message.id,
        );
        if (ingested) {
          // Re-resolve: agora o cliente existe e tem budget criado pelo trigger.
          resolved = await resolveContactAndBudget(supabase, cfg, ingested.contact, ingested.contact.id);
          console.log(JSON.stringify({
            tag: "[digisac-webhook]",
            event: "bw_marker_ingested",
            marker,
            client_id: ingested.clientId,
            budget_resolved: Boolean(resolved),
          }));
        }
      } catch (err) {
        console.error(JSON.stringify({
          tag: "[digisac-webhook]",
          event: "bw_ingest_failed",
          marker,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
  }

  // ---------- Atribuição de marcador BW para budget JÁ existente ----------
  // Se temos budget mas as colunas de tracking estão vazias, preenche a partir
  // do marcador (sem sobrescrever valores existentes).
  if (resolved) {
    const marker = parseBwMarker(message.body);
    if (marker) {
      await backfillBudgetAttribution(supabase, resolved.budgetId, marker);
    }
  }

  if (!resolved) {
    console.warn(JSON.stringify({
      tag: "[digisac-webhook]",
      event: "no_matching_budget",
      message_id: message.id,
      contact_id: contactId,
      had_bw_marker: Boolean(parseBwMarker(message.body)),
    }));
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

  // Lê o body como texto bruto — necessário para HMAC antes de fazer o JSON.parse.
  const rawBody = await req.text();

  const auth = await verifyWebhookAuth(req, rawBody, cfg.webhookSecret);
  if (!auth.ok) {
    console.warn(
      "[digisac-webhook] auth_failed",
      JSON.stringify({
        reason: auth.reason,
        ...auth.details,
        ...requestFingerprint(req),
      }),
    );
    return jsonResponse(
      {
        error: "Unauthorized",
        reason: auth.reason,
        hint:
          "Configure o webhook do Digisac para assinar com HMAC-SHA256 e enviar em x-digisac-signature: sha256=<hex>. Como fallback, aceitamos token em x-webhook-secret, x-api-key, Authorization: Bearer ou ?secret=.",
      },
      401,
    );
  }

  let body: Record<string, unknown> = {};
  if (rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
  }

  const eventType = extractEventType(body).toLowerCase();
  const ids = extractIds(body);

  // ----- Idempotência: descarta reentregas do mesmo evento -----
  const eventKey = await computeEventKey(rawBody, eventType, ids);
  const dedup = await checkAndReserveEvent(supabase, eventKey, eventType, ids);
  if (dedup.duplicate) {
    console.log(
      "[digisac-webhook] event_duplicate_ignored",
      JSON.stringify({ event: eventType, ids, event_key: eventKey.slice(0, 16) }),
    );
    return jsonResponse(
      {
        success: true,
        deduplicated: true,
        event_key: eventKey,
        previous_result: dedup.cachedResult ?? null,
      },
      200,
    );
  }

  console.log(
    "[digisac-webhook] event_received",
    JSON.stringify({
      event: eventType,
      ids,
      auth_mode: auth.mode,
      event_key: eventKey.slice(0, 16),
    }),
  );

  let response: Response;
  try {
    if (eventType.includes("message")) {
      response = await handleMessageEvent(supabase, cfg, body, ids);
    } else if (eventType.includes("ticket")) {
      response = await handleTicketEvent(supabase, cfg, body, ids);
    } else if (eventType.includes("contact")) {
      response = await handleContactEvent(supabase, body);
    } else if (ids.messageId) {
      // Evento desconhecido → tenta inferir pelo payload
      response = await handleMessageEvent(supabase, cfg, body, ids);
    } else if (ids.ticketId) {
      response = await handleTicketEvent(supabase, cfg, body, ids);
    } else if (ids.contactId) {
      response = await handleContactEvent(supabase, body);
    } else {
      response = jsonResponse(
        { success: false, reason: "unknown_event", event: eventType },
        200,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digisac-webhook] erro processando evento:", msg);
    // Apaga reserva para que retentativas legítimas (mesma chave) possam reprocessar.
    await supabase.from("digisac_webhook_events").delete().eq("event_key", eventKey);
    return jsonResponse({ error: msg }, 500);
  }

  // Persiste o resultado para devolver em reentregas futuras.
  try {
    const cloned = response.clone();
    const resultBody = (await cloned.json()) as Record<string, unknown>;
    await recordEventResult(supabase, eventKey, resultBody);
  } catch {
    // Se o body não for JSON, ignora — a reserva por si só já garante idempotência.
  }

  return response;
});
