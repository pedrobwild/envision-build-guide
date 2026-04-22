// Notificações WhatsApp automáticas em transições de status do orçamento.
//
// Disparada por trigger PG (pg_net) ou manualmente.
// Entrada: { budget_id, new_status }
//
// Regras:
//  - new_status = 'requested'           → notifica o ORÇAMENTISTA responsável (estimator_owner_id)
//                                          ou todos os usuários com role 'orcamentista' se não houver dono
//  - new_status = 'delivered_to_sales'  → notifica o COMERCIAL responsável (commercial_owner_id)
//                                          ou todos os usuários com role 'comercial' se não houver dono
//
// verify_jwt = false (chamada via trigger PG com service-role key no header).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CORS_HEADERS,
  digisacFetch,
  jsonResponse,
  loadDigisacConfig,
  normalizePhone,
  sendDigisacMessage,
  unwrapList,
  unwrapObject,
} from "../_shared/digisac.ts";

interface Body {
  budget_id?: string;
  new_status?: string;
}

interface Recipient {
  user_id: string;
  full_name: string | null;
  whatsapp: string | null;
}

const PUBLIC_BASE_URL = Deno.env.get("PUBLIC_APP_URL") ??
  "https://orcamento-bwild.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let payload: Body;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const budgetId = (payload.budget_id ?? "").toString().trim();
  const newStatus = (payload.new_status ?? "").toString().trim();
  if (!budgetId || !newStatus) {
    return jsonResponse({ error: "budget_id e new_status são obrigatórios" }, 400);
  }

  // Apenas dois status disparam notificação automática
  if (newStatus !== "requested" && newStatus !== "delivered_to_sales") {
    return jsonResponse({ skipped: true, reason: "status sem regra de notificação" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Carrega orçamento
  const { data: budget, error: bErr } = await supabase
    .from("budgets")
    .select(
      "id, sequential_code, project_name, client_name, estimator_owner_id, commercial_owner_id",
    )
    .eq("id", budgetId)
    .maybeSingle();

  if (bErr || !budget) {
    console.error("[notify-status-change] budget não encontrado:", bErr?.message);
    return jsonResponse({ error: "Orçamento não encontrado" }, 404);
  }

  // Identifica destinatários
  const targetRole = newStatus === "requested" ? "orcamentista" : "comercial";
  const targetOwnerId = newStatus === "requested"
    ? budget.estimator_owner_id
    : budget.commercial_owner_id;

  let recipients: Recipient[] = [];

  if (targetOwnerId) {
    // Notifica apenas o responsável
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, full_name, whatsapp")
      .eq("id", targetOwnerId)
      .maybeSingle();
    if (owner?.whatsapp) {
      recipients = [{
        user_id: owner.id,
        full_name: owner.full_name,
        whatsapp: owner.whatsapp,
      }];
    }
  } else {
    // Sem dono: notifica todos com a role
    const { data: roleUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", targetRole);
    const ids = (roleUsers ?? []).map((r) => r.user_id);
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, whatsapp")
        .in("id", ids);
      recipients = (profs ?? [])
        .filter((p) => !!p.whatsapp)
        .map((p) => ({
          user_id: p.id,
          full_name: p.full_name,
          whatsapp: p.whatsapp,
        }));
    }
  }

  if (recipients.length === 0) {
    console.warn(
      `[notify-status-change] Sem destinatários com WhatsApp (status=${newStatus}, budget=${budgetId})`,
    );
    return jsonResponse({ success: true, sent: 0, reason: "sem WhatsApp cadastrado" });
  }

  // Monta mensagem
  const code = budget.sequential_code ?? "";
  const project = budget.project_name ?? "Sem nome";
  const client = budget.client_name ?? "Cliente";
  const internalLink = `${PUBLIC_BASE_URL}/admin/orcamento/${budgetId}`;

  const message = newStatus === "requested"
    ? `🆕 *Nova solicitação de orçamento*\n\n` +
      `${code ? `*${code}* · ` : ""}${project}\n` +
      `Cliente: ${client}\n\n` +
      `Acesse: ${internalLink}`
    : `📤 *Orçamento entregue ao Comercial*\n\n` +
      `${code ? `*${code}* · ` : ""}${project}\n` +
      `Cliente: ${client}\n\n` +
      `Pronto para revisão e envio ao cliente:\n${internalLink}`;

  // Carrega config Digisac
  const cfg = await loadDigisacConfig(supabase);
  if (!cfg.enabled || !cfg.apiToken) {
    console.warn("[notify-status-change] Digisac desabilitado ou sem token");
    return jsonResponse({ success: false, reason: "Digisac não configurado" });
  }

  // Envia para cada destinatário
  const results: { user: string; ok: boolean; error?: string }[] = [];
  for (const rec of recipients) {
    const normalized = normalizePhone(rec.whatsapp ?? "");
    if (!normalized) {
      results.push({ user: rec.full_name ?? rec.user_id, ok: false, error: "phone inválido" });
      continue;
    }
    try {
      // Resolve contactId
      let contactId: string | null = null;
      const variants = Array.from(new Set([`55${normalized}`, normalized]));
      for (const term of variants) {
        try {
          const search = await digisacFetch(
            cfg,
            `/contacts?term=${encodeURIComponent(term)}&limit=5`,
          );
          const items = unwrapList<Record<string, unknown>>(search);
          const found = items.find((c) => {
            const num = (c.number as string | undefined) ?? (c.phone as string | undefined) ?? "";
            return normalizePhone(num) === normalized;
          });
          if (found?.id) {
            contactId = String(found.id);
            break;
          }
        } catch (err) {
          console.error("[notify-status-change] contact search:", err);
        }
      }

      if (!contactId) {
        const created = await digisacFetch(cfg, `/contacts`, {
          method: "POST",
          body: JSON.stringify({
            number: `55${normalized}`,
            name: rec.full_name ?? `Equipe ${normalized}`,
          }),
        });
        const obj = unwrapObject<Record<string, unknown>>(created);
        contactId = (obj.id as string | undefined) ?? null;
      }

      if (!contactId) {
        results.push({ user: rec.full_name ?? rec.user_id, ok: false, error: "sem contactId" });
        continue;
      }

      await sendDigisacMessage(cfg, {
        contactId,
        body: message,
        attachmentUrl: null,
        serviceId: cfg.defaultServiceId,
        userId: cfg.defaultUserId,
      });
      results.push({ user: rec.full_name ?? rec.user_id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[notify-status-change] send failed:", msg);
      results.push({ user: rec.full_name ?? rec.user_id, ok: false, error: msg });
    }
  }

  return jsonResponse({
    success: true,
    status: newStatus,
    budget_id: budgetId,
    sent: results.filter((r) => r.ok).length,
    results,
  });
});
