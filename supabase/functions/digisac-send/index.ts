// Envia uma mensagem via Digisac. Invocada pelo frontend via supabase.functions.invoke.
//
// Payload esperado:
// {
//   "conversation_id": "<uuid da budget_conversations>",  // OU
//   "contact_id": "<id do contato no Digisac>",            // se for nova conversa
//   "text": "Olá!",
//   "reply_to_external_id": "<opcional>"
// }

import {
  corsHeaders,
  loadDigisacConfig,
  getSupabaseAdmin,
  digisacRequest,
  upsertMessage,
} from "../_shared/digisac.ts";

interface SendBody {
  conversation_id?: string;
  contact_id?: string;
  text: string;
  reply_to_external_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Valida autenticação do chamador (usuário logado).
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();
  const cfg = await loadDigisacConfig(supabase);
  if (!cfg) {
    return new Response(
      JSON.stringify({ error: "Digisac não configurado" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.text || body.text.trim().length === 0) {
    return new Response(JSON.stringify({ error: "text vazio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const conversationId = body.conversation_id;
  let contactExternalId = body.contact_id;
  let ticketExternalId: string | null = null;

  if (conversationId) {
    const { data: conv } = await supabase
      .from("budget_conversations")
      .select("id, external_id, contact_identifier, provider, provider_data")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) {
      return new Response(JSON.stringify({ error: "conversation_id inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    ticketExternalId = conv.external_id ?? null;
    const providerData = (conv.provider_data ?? {}) as Record<string, unknown>;
    const ticketObj = providerData?.ticket as { contactId?: string } | undefined;
    contactExternalId = contactExternalId ?? ticketObj?.contactId ?? undefined;
  }

  if (!ticketExternalId && !contactExternalId) {
    return new Response(
      JSON.stringify({ error: "É necessário conversation_id ou contact_id" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Digisac aceita envio por ticketId (reabrindo se estiver fechado) ou contactId.
  // Usamos o endpoint /messages com o campo apropriado.
  const payload: Record<string, unknown> = {
    text: body.text,
    ...(ticketExternalId ? { ticketId: ticketExternalId } : {}),
    ...(contactExternalId ? { contactId: contactExternalId } : {}),
    ...(body.reply_to_external_id ? { quotedMessageId: body.reply_to_external_id } : {}),
    ...(cfg.default_service_id ? { serviceId: cfg.default_service_id } : {}),
    ...(cfg.default_user_id ? { userId: cfg.default_user_id } : {}),
  };

  let sent: Record<string, unknown>;
  try {
    sent = await digisacRequest<Record<string, unknown>>(cfg, "/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const sentWrapper = sent as { data?: Record<string, unknown> };
  const sentMsg = (sentWrapper.data ?? sent) as Record<string, unknown>;
  const newExternalId = (sentMsg.id as string) ?? null;

  // Registra localmente (direction = "out") para feedback imediato na UI.
  if (conversationId) {
    try {
      await upsertMessage(supabase, {
        conversation_id: conversationId,
        external_id: newExternalId,
        direction: "out",
        author_name: "Você",
        body: body.text,
        message_type: "chat",
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_data: sentMsg,
      });
      await supabase
        .from("budget_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: body.text.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } catch (e) {
      console.warn("[digisac-send] local insert failed:", e);
    }
  }

  return new Response(
    JSON.stringify({ success: true, message_id: newExternalId, raw: sentMsg }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
