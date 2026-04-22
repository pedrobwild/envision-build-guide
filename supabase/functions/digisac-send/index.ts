// Envia mensagens do sistema → Digisac.
//
// Entrada (POST JSON):
//   - { conversationId, body, attachmentUrl?, replyToExternalId? }
//     Envia via conversa existente. Usa provider_data.contact.id para
//     localizar o contato no Digisac.
//   - { contactId, body, attachmentUrl? }
//     Envia direto para um contactId do Digisac (útil para primeira mensagem).
//
// Regras:
//   - verify_jwt = true (usuário autenticado no Supabase)
//   - grava a mensagem como direction=out na tabela budget_conversation_messages
//     com o external_id retornado pela API do Digisac.

import {
  CORS_HEADERS,
  jsonResponse,
  loadDigisacConfig,
  makeServiceClient,
  sendDigisacMessage,
  upsertMessage,
} from "../_shared/digisac.ts";

interface Body {
  conversationId?: string;
  contactId?: string;
  body?: string;
  attachmentUrl?: string;
  replyToExternalId?: string;
  authorName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Identifica o usuário chamador (verify_jwt=true garante que existe).
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const supabase = makeServiceClient();
  const cfg = await loadDigisacConfig(supabase);

  if (!cfg.enabled) {
    return jsonResponse({ error: "Digisac integration desabilitada" }, 400);
  }
  if (!cfg.apiToken) {
    return jsonResponse(
      { error: "DIGISAC_API_TOKEN ausente. Configure nos secrets ou em digisac_config." },
      500,
    );
  }

  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const messageBody = (payload.body ?? "").toString();
  if (!messageBody && !payload.attachmentUrl) {
    return jsonResponse(
      { error: "Body ou attachmentUrl é obrigatório." },
      400,
    );
  }

  // Resolve contactId + (opcional) conversationId no nosso banco.
  let contactId = payload.contactId ?? null;
  const conversationId = payload.conversationId ?? null;
  interface ConversationRowShape {
    id: string;
    provider_data: Record<string, unknown> | null;
    contact_identifier: string | null;
  }
  let conversationRow: ConversationRowShape | null = null;

  if (conversationId) {
    const { data, error } = await supabase
      .from("budget_conversations")
      .select("id, provider_data, contact_identifier")
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !data) {
      return jsonResponse({ error: "Conversa não encontrada." }, 404);
    }
    conversationRow = data as unknown as ConversationRowShape;

    if (!contactId) {
      const pd = (conversationRow.provider_data ?? {}) as Record<string, unknown>;
      const ct = (pd.contact as Record<string, unknown>) ?? {};
      contactId =
        (typeof ct.id === "string" ? ct.id : null) ??
        conversationRow.contact_identifier ??
        null;
    }
  }

  if (!contactId) {
    return jsonResponse(
      {
        error:
          "contactId não encontrado. Envie contactId explicitamente ou use uma conversa que já tenha provider_data.contact.id.",
      },
      400,
    );
  }

  // Tenta capturar o nome do usuário autenticado (para author_name).
  let authorName = payload.authorName ?? null;
  if (!authorName && jwt) {
    try {
      const { data: userData } = await supabase.auth.getUser(jwt);
      authorName =
        (userData.user?.user_metadata as Record<string, unknown> | undefined)?.full_name?.toString() ??
        userData.user?.email ??
        null;
    } catch {
      /* ignore */
    }
  }

  // Envia a mensagem para o Digisac.
  let apiResp: Record<string, unknown>;
  try {
    apiResp = await sendDigisacMessage(cfg, {
      contactId,
      body: messageBody,
      attachmentUrl: payload.attachmentUrl ?? null,
      serviceId: cfg.defaultServiceId,
      userId: cfg.defaultUserId,
      replyToId: payload.replyToExternalId ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digisac-send] falha ao enviar:", msg);
    return jsonResponse({ error: `Falha ao enviar para Digisac: ${msg}` }, 502);
  }

  // ID da mensagem retornado pela API.
  const externalId =
    (apiResp.id as string | undefined) ??
    (((apiResp.data as Record<string, unknown>) ?? {}).id as string | undefined) ??
    null;

  // Persiste no nosso banco se tivermos conversa associada.
  let storedMessageId: string | null = null;
  if (conversationRow) {
    const upserted = await upsertMessage(supabase, {
      conversationId: conversationRow.id,
      externalId,
      direction: "out",
      authorName,
      body: messageBody,
      messageType: payload.attachmentUrl ? "file" : "text",
      status: "sent",
      replyToExternalId: payload.replyToExternalId ?? null,
      attachments: payload.attachmentUrl
        ? [{ url: payload.attachmentUrl }]
        : [],
      sentAt: new Date().toISOString(),
      providerData: apiResp,
    });
    storedMessageId = upserted.id;

    await supabase
      .from("budget_conversations")
      .update({
        last_message_preview: messageBody.slice(0, 200),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversationRow.id);
  }

  return jsonResponse(
    {
      success: true,
      external_id: externalId,
      message_id: storedMessageId,
      provider_response: apiResp,
    },
    200,
  );
});
