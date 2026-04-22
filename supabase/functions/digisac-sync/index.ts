// Backfill / import de tickets e mensagens recentes do Digisac.
// Chamado manualmente (botão "Sincronizar agora" na UI) ou via cron.
//
// Payload de entrada (opcional):
//   { limit?: number, ticketIds?: string[] }
//
// Só persiste conversas de contatos que batem com algum orçamento.

import {
  CORS_HEADERS,
  findBudgetForContact,
  jsonResponse,
  loadDigisacConfig,
  makeServiceClient,
  fetchContact,
  fetchRecentTickets,
  fetchTicket,
  fetchTicketMessages,
  upsertConversation,
  upsertDigisacContact,
  upsertMessage,
  type DigisacContact,
  type DigisacTicket,
} from "../_shared/digisac.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface SyncResult {
  tickets_scanned: number;
  tickets_matched: number;
  tickets_skipped_no_budget: number;
  messages_upserted: number;
  errors: Array<{ ticket_id: string; error: string }>;
}

async function processTicket(
  supabase: SupabaseClient,
  cfg: Awaited<ReturnType<typeof loadDigisacConfig>>,
  ticket: DigisacTicket,
  result: SyncResult,
): Promise<void> {
  result.tickets_scanned++;

  let contact: DigisacContact | null = null;
  if (ticket.contactId) {
    try {
      contact = await fetchContact(cfg, ticket.contactId);
    } catch (err) {
      console.warn(
        `[digisac-sync] falha buscando contato ${ticket.contactId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  if (!contact) {
    result.tickets_skipped_no_budget++;
    return;
  }

  await upsertDigisacContact(supabase, contact);

  const match = await findBudgetForContact(supabase, {
    phone: contact.phone,
    email: contact.email,
  });
  if (!match) {
    result.tickets_skipped_no_budget++;
    return;
  }

  const conv = await upsertConversation(supabase, {
    budgetId: match.budgetId,
    externalId: ticket.id,
    channel: ticket.channel,
    contactName: contact.name ?? null,
    contactIdentifier: contact.phone ?? contact.email ?? contact.id,
    status: ticket.status,
    assignedUserName: ticket.assignedUserName,
    avatarUrl: contact.avatarUrl ?? null,
    lastMessagePreview: null,
    lastMessageAt: ticket.updatedAt ?? new Date().toISOString(),
    providerData: {
      contact: contact.raw,
      ticket: ticket.raw,
    },
  });

  result.tickets_matched++;

  // Importa mensagens do ticket.
  try {
    const messages = await fetchTicketMessages(cfg, ticket.id, 100);
    for (const m of messages) {
      const { inserted } = await upsertMessage(supabase, {
        conversationId: conv.id,
        externalId: m.id,
        direction: m.direction,
        authorName: m.authorName,
        body: m.body,
        messageType: m.messageType,
        status: m.status,
        replyToExternalId: m.replyToExternalId,
        attachments: m.attachments,
        sentAt: m.sentAt ?? null,
        providerData: m.raw,
      });
      if (inserted) result.messages_upserted++;
    }

    // Atualiza preview/last_message_at com base na última mensagem recebida.
    if (messages.length > 0) {
      const latest = messages.reduce((acc, m) => {
        if (!acc) return m;
        const a = acc.sentAt ? Date.parse(acc.sentAt) : 0;
        const b = m.sentAt ? Date.parse(m.sentAt) : 0;
        return b > a ? m : acc;
      }, messages[0]);
      await supabase
        .from("budget_conversations")
        .update({
          last_message_preview: (latest.body ?? "").slice(0, 200),
          last_message_at: latest.sentAt ?? ticket.updatedAt ?? new Date().toISOString(),
        })
        .eq("id", conv.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[digisac-sync] erro em mensagens do ticket ${ticket.id}: ${msg}`);
    result.errors.push({ ticket_id: ticket.id, error: msg });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabase = makeServiceClient();
  const cfg = await loadDigisacConfig(supabase);

  if (!cfg.enabled) {
    return jsonResponse({ success: false, reason: "integration_disabled" }, 200);
  }
  if (!cfg.apiToken) {
    return jsonResponse(
      {
        error: "DIGISAC_API_TOKEN ausente",
        hint:
          "Defina DIGISAC_API_TOKEN via `supabase secrets set` ou preencha digisac_config.api_token",
      },
      500,
    );
  }

  let body: { limit?: number; ticketIds?: string[] } = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);

  const result: SyncResult = {
    tickets_scanned: 0,
    tickets_matched: 0,
    tickets_skipped_no_budget: 0,
    messages_upserted: 0,
    errors: [],
  };

  try {
    let tickets: DigisacTicket[] = [];
    if (body.ticketIds && body.ticketIds.length > 0) {
      for (const id of body.ticketIds) {
        try {
          const t = await fetchTicket(cfg, id);
          if (t) tickets.push(t);
        } catch (err) {
          result.errors.push({
            ticket_id: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } else {
      tickets = await fetchRecentTickets(cfg, limit);
    }

    for (const t of tickets) {
      try {
        await processTicket(supabase, cfg, t, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[digisac-sync] erro no ticket ${t.id}: ${msg}`);
        result.errors.push({ ticket_id: t.id, error: msg });
      }
    }

    return jsonResponse({ success: true, ...result }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[digisac-sync] erro global:", msg);
    return jsonResponse({ error: msg, ...result }, 500);
  }
});
