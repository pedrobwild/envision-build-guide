// Wrapper público para enviar mensagens WhatsApp via Digisac.
//
// Entrada (POST JSON):
//   { phone, message, serviceId?, userId?, budgetId?, attachmentUrl? }
//
// Comportamento:
//   - Resolve o contactId no Digisac via GET /contacts?term={phone}
//   - Cria contato se não existir (POST /contacts)
//   - Dispara mensagem via POST /messages
//   - Se budgetId for fornecido, grava mensagem em budget_conversation_messages
//
// Auth: verify_jwt = true (apenas usuários autenticados).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CORS_HEADERS,
  digisacFetch,
  jsonResponse,
  loadDigisacConfig,
  makeServiceClient,
  normalizePhone,
  sendDigisacMessage,
  unwrapList,
  unwrapObject,
  upsertConversation,
  upsertMessage,
} from "../_shared/digisac.ts";

interface Body {
  phone?: string;
  message?: string;
  serviceId?: string;
  userId?: string;
  budgetId?: string;
  attachmentUrl?: string;
  authorName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const jwt = authHeader.slice(7).trim();

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: authErr } = await authClient.auth.getClaims(jwt);
  if (authErr || !claims?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Parse body
  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const phone = (payload.phone ?? "").toString().trim();
  const message = (payload.message ?? "").toString();

  if (!phone) {
    return jsonResponse({ error: "phone é obrigatório." }, 400);
  }
  if (!message && !payload.attachmentUrl) {
    return jsonResponse({ error: "message ou attachmentUrl é obrigatório." }, 400);
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return jsonResponse({ error: "phone inválido." }, 400);
  }

  const supabase = makeServiceClient();
  const cfg = await loadDigisacConfig(supabase);

  if (!cfg.enabled) {
    return jsonResponse({ error: "Integração Digisac desabilitada." }, 400);
  }
  if (!cfg.apiToken) {
    return jsonResponse(
      { error: "DIGISAC_API_TOKEN ausente. Configure em /admin/digisac." },
      500,
    );
  }

  // Resolve contactId no Digisac
  // Tenta variantes: com 55 (Brasil) e sem
  const variants = Array.from(new Set([
    `55${normalizedPhone}`,
    normalizedPhone,
  ]));

  let contactId: string | null = null;
  for (const term of variants) {
    try {
      const search = await digisacFetch(
        cfg,
        `/contacts?term=${encodeURIComponent(term)}&limit=5`,
      );
      const items = unwrapList<Record<string, unknown>>(search);
      const found = items.find((c) => {
        const num = (c.number as string | undefined) ??
          (c.phone as string | undefined) ?? "";
        return normalizePhone(num) === normalizedPhone;
      });
      if (found?.id) {
        contactId = String(found.id);
        break;
      }
    } catch (err) {
      console.error("[send-digisac-message] contact search error:", err);
    }
  }

  // Cria contato se não encontrou
  if (!contactId) {
    try {
      const created = await digisacFetch(cfg, `/contacts`, {
        method: "POST",
        body: JSON.stringify({
          number: `55${normalizedPhone}`,
          name: `Cliente ${normalizedPhone}`,
        }),
      });
      const obj = unwrapObject<Record<string, unknown>>(created);
      contactId = (obj.id as string | undefined) ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[send-digisac-message] create contact failed:", msg);
      return jsonResponse(
        { error: `Falha ao criar contato no Digisac: ${msg}` },
        502,
      );
    }
  }

  if (!contactId) {
    return jsonResponse(
      { error: "Não foi possível resolver contactId no Digisac." },
      502,
    );
  }

  // Envia mensagem
  let apiResp: Record<string, unknown>;
  try {
    apiResp = await sendDigisacMessage(cfg, {
      contactId,
      body: message,
      attachmentUrl: payload.attachmentUrl ?? null,
      serviceId: payload.serviceId ?? cfg.defaultServiceId,
      userId: payload.userId ?? cfg.defaultUserId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-digisac-message] send failed:", msg);
    return jsonResponse({ error: `Falha ao enviar mensagem: ${msg}` }, 502);
  }

  const externalId =
    (apiResp.id as string | undefined) ??
    (((apiResp.data as Record<string, unknown>) ?? {}).id as string | undefined) ??
    null;

  // Persiste no histórico se budgetId fornecido
  let storedMessageId: string | null = null;
  if (payload.budgetId) {
    try {
      const conv = await upsertConversation(supabase, {
        budgetId: payload.budgetId,
        externalId: contactId, // usa contactId como external_id da conversa
        channel: "whatsapp",
        contactName: null,
        contactIdentifier: contactId,
        status: "open",
        assignedUserName: null,
        avatarUrl: null,
        lastMessagePreview: message.slice(0, 200),
        lastMessageAt: new Date().toISOString(),
        providerData: { contact: { id: contactId } },
      });

      const stored = await upsertMessage(supabase, {
        conversationId: conv.id,
        externalId,
        direction: "out",
        authorName: payload.authorName ?? null,
        body: message,
        messageType: payload.attachmentUrl ? "file" : "text",
        status: "sent",
        replyToExternalId: null,
        attachments: payload.attachmentUrl ? [{ url: payload.attachmentUrl }] : [],
        sentAt: new Date().toISOString(),
        providerData: apiResp,
      });
      storedMessageId = stored.id;
    } catch (err) {
      console.error("[send-digisac-message] persist error:", err);
    }
  }

  return jsonResponse({
    success: true,
    contact_id: contactId,
    external_id: externalId,
    message_id: storedMessageId,
  });
});
