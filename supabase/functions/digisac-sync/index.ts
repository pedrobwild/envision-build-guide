// Sincroniza (backfill) tickets e mensagens recentes do Digisac.
// Pode ser chamado manualmente pelo frontend ("Sincronizar agora") ou por cron.
//
// Payload (POST):
// {
//   "since": "2024-01-01T00:00:00Z",   // opcional: buscar desde essa data
//   "limit": 50,                        // opcional: máx de tickets (default 50)
//   "messages_per_ticket": 30           // opcional: default 30
// }

import {
  corsHeaders,
  loadDigisacConfig,
  getSupabaseAdmin,
  digisacRequest,
  upsertConversation,
  upsertMessage,
  upsertDigisacContact,
  normalizePhone,
  type DigisacContact,
  type DigisacTicket,
  type DigisacMessage,
} from "../_shared/digisac.ts";

const PROVIDER = "digisac";

interface TicketListResponse {
  data?: DigisacTicket[];
  tickets?: DigisacTicket[];
  results?: DigisacTicket[];
}

interface MessageListResponse {
  data?: DigisacMessage[];
  messages?: DigisacMessage[];
  results?: DigisacMessage[];
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
      JSON.stringify({ error: "Digisac não configurado" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { since?: string; limit?: number; messages_per_ticket?: number } = {};
  try {
    body = await req.json();
  } catch {
    // POST sem body é permitido
  }

  const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
  const msgsPerTicket = Math.min(Math.max(body.messages_per_ticket ?? 30, 1), 100);
  const since = body.since ?? null;

  let ticketsRaw: TicketListResponse;
  try {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("include", "contact,user,service");
    qs.set("sort", "-lastMessageAt");
    if (since) qs.set("updatedAfter", since);
    ticketsRaw = await digisacRequest<TicketListResponse>(cfg, `/tickets?${qs.toString()}`);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tickets = ticketsRaw.data ?? ticketsRaw.tickets ?? ticketsRaw.results ?? [];

  let processedTickets = 0;
  let processedMessages = 0;
  const errors: Array<{ ticketId: string; error: string }> = [];

  for (const tk of tickets) {
    if (!tk?.id) continue;
    try {
      let contact: DigisacContact | null = (tk.contact as DigisacContact) ?? null;
      if (!contact && tk.contactId) {
        try {
          const res = await digisacRequest<DigisacContact | { data: DigisacContact }>(
            cfg,
            `/contacts/${tk.contactId}`,
          );
          const wrapper = res as { data?: DigisacContact };
          contact = (wrapper.data ?? (res as DigisacContact)) as DigisacContact;
        } catch { /* noop */ }
      }

      if (contact) {
        await upsertDigisacContact(supabase, contact).catch(() => {/* noop */});
      }

      const phone = normalizePhone(contact?.number ?? contact?.phoneNumber ?? null);
      const conversationId = await upsertConversation(supabase, {
        provider: PROVIDER,
        external_id: tk.id,
        channel: ((tk as Record<string, unknown>).channel as string | null)
          ?? ((tk as Record<string, unknown>).type as string | null)
          ?? "whatsapp",
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
      processedTickets++;

      // Puxa últimas N mensagens do ticket.
      try {
        const q = new URLSearchParams();
        q.set("ticketId", tk.id);
        q.set("limit", String(msgsPerTicket));
        q.set("sort", "-timestamp");
        const msgsRaw = await digisacRequest<MessageListResponse>(cfg, `/messages?${q.toString()}`);
        const msgs = msgsRaw.data ?? msgsRaw.messages ?? msgsRaw.results ?? [];

        for (const m of msgs) {
          if (!m?.id) continue;
          const fromMe = (m.fromMe ?? m.isFromMe ?? false) as boolean;
          const direction: "in" | "out" = fromMe ? "out" : "in";
          const attachments: unknown[] = [];
          if (m.file && typeof m.file === "object" && m.file.url) {
            attachments.push({
              url: m.file.url,
              name: m.file.name ?? null,
              mimetype: m.file.mimetype ?? null,
            });
          }
          await upsertMessage(supabase, {
            conversation_id: conversationId,
            external_id: m.id,
            direction,
            author_name: direction === "out" ? (tk.user?.name ?? "Atendente") : (contact?.name ?? null),
            body: m.text ?? null,
            message_type: m.type ?? null,
            status: m.status ?? null,
            sent_at: m.timestamp ?? null,
            attachments,
            reply_to_external_id: m.quotedMessageId ?? null,
            provider_data: m as unknown as Record<string, unknown>,
          });
          processedMessages++;
        }
      } catch (e) {
        console.warn(`[digisac-sync] messages fetch failed for ${tk.id}:`, e);
      }
    } catch (e) {
      errors.push({
        ticketId: tk.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  await supabase
    .from("digisac_config")
    .update({ last_synced_at: new Date().toISOString() })
    .not("id", "is", null);

  return new Response(
    JSON.stringify({
      success: true,
      tickets: processedTickets,
      messages: processedMessages,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
