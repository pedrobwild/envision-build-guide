import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_AFFECTED = 500;
const PROTECTED_STATUSES = ["contrato_fechado", "perdido", "lost", "archived"];

const SYSTEM_PROMPT = `Você é o orquestrador de **operações em lote** do sistema BWild. Sua única função é converter um comando em linguagem natural do administrador em uma chamada estruturada da função \`plan_bulk_operation\`.

REGRAS CRÍTICAS:
- Datas devem estar em ISO 8601 (YYYY-MM-DD). Se o usuário disser "hoje", use a data atual; "ontem" = data atual − 1 dia; "esta semana" = últimos 7 dias.
- O único filtro aceito nesta versão é \`created_from\` (e opcionalmente \`created_to\`).
- Tipos de ação suportados:
  1. **financial_adjustment**: ajusta o valor dos itens proporcionalmente. Params: \`mode\` ('percent'|'amount'), \`value\` (número, negativo = redução), \`direction\` ('increase'|'decrease').
     Ex.: "reduzir 10% em todos" → mode=percent, value=10, direction=decrease.
  2. **status_change**: muda \`internal_status\`. Params: \`new_status\`.
  3. **assign_owner**: atribui responsável. Params: \`role\` ('commercial'|'estimator'), \`owner_name\` (nome aproximado do usuário).
- Nunca altere orçamentos com status \`contrato_fechado\` ou \`perdido\` (o backend já bloqueia, mas avise no \`reasoning\`).
- Se o pedido não puder ser estruturado (faltam dados, fora de escopo), use mode=null e explique no campo \`reasoning\`.
`;

const TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "plan_bulk_operation",
    description: "Estrutura um comando administrativo em uma operação em lote.",
    parameters: {
      type: "object",
      properties: {
        action_type: {
          type: "string",
          enum: ["financial_adjustment", "status_change", "assign_owner", "unsupported"],
        },
        filters: {
          type: "object",
          properties: {
            created_from: { type: "string", description: "Data ISO YYYY-MM-DD inclusive" },
            created_to: { type: "string", description: "Data ISO YYYY-MM-DD inclusive (opcional)" },
          },
        },
        params: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["percent", "amount"] },
            value: { type: "number" },
            direction: { type: "string", enum: ["increase", "decrease"] },
            new_status: { type: "string" },
            role: { type: "string", enum: ["commercial", "estimator"] },
            owner_name: { type: "string" },
          },
        },
        summary: {
          type: "string",
          description: "Resumo curto, em pt-BR, do que será feito (ex.: 'Reduzir 10% em todos os orçamentos criados desde 01/01/2026').",
        },
        reasoning: {
          type: "string",
          description: "Explicação curta do raciocínio. Use para alertar sobre status protegidos ou pedidos ambíguos.",
        },
      },
      required: ["action_type", "summary"],
      additionalProperties: false,
    },
  },
};

type ActionType = "financial_adjustment" | "status_change" | "assign_owner";
type Mode = "percent" | "amount";

interface PlanRow {
  budget_id: string;
  sequential_code: string | null;
  client_name: string;
  project_name: string;
  current_status: string;
  before_total: number;
  after_total: number;
  delta: number;
  changes_summary: string;
  protected: boolean;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

async function callAIPlanner(command: string, today: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\nData de hoje: ${today}.` },
        { role: "user", content: command },
      ],
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "function", function: { name: "plan_bulk_operation" } },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("Limite de IA atingido. Tente novamente em alguns segundos.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações.");
    throw new Error(`Falha na IA: ${resp.status} ${text.slice(0, 300)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("IA não retornou um plano estruturado.");
  try {
    return JSON.parse(call.function.arguments) as {
      action_type: ActionType | "unsupported";
      filters?: { created_from?: string; created_to?: string };
      params?: Record<string, unknown>;
      summary: string;
      reasoning?: string;
    };
  } catch {
    throw new Error("Não foi possível interpretar o plano gerado pela IA.");
  }
}

function validateDate(s: string | undefined): string | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : s;
}

function calcItemSale(item: { qty: number | null; internal_unit_price: number | null; internal_total: number | null; bdi_percentage: number | null }): number {
  const unitPrice = Number(item.internal_unit_price) || 0;
  const bdi = Number(item.bdi_percentage) || 0;
  if (unitPrice > 0) {
    const qty = Number(item.qty) || 1;
    return unitPrice * (1 + bdi / 100) * qty;
  }
  const total = Number(item.internal_total) || 0;
  return total > 0 ? total * (1 + bdi / 100) : 0;
}

async function buildFinancialPlan(
  // deno-lint-ignore no-explicit-any
  admin: any,
  budgets: Array<{ id: string; sequential_code: string | null; client_name: string; project_name: string; internal_status: string }>,
  params: { mode: Mode; value: number; direction: "increase" | "decrease" },
) {
  const factor = params.direction === "decrease" ? 1 - params.value / 100 : 1 + params.value / 100;
  if (params.mode !== "percent") {
    throw new Error("Esta versão suporta apenas ajuste percentual proporcional.");
  }
  if (factor <= 0) throw new Error("Ajuste resultaria em valores negativos ou zero.");

  const rows: PlanRow[] = [];
  const ids = budgets.map((b) => b.id);

  const { data: sectionsRaw, error: secErr } = await admin
    .from("sections")
    .select("id, budget_id, qty, section_price")
    .in("budget_id", ids);
  if (secErr) throw secErr;
  type Section = { id: string; budget_id: string; qty: number | null; section_price: number | null };
  const sections = (sectionsRaw ?? []) as Section[];

  const sectionsByBudget = new Map<string, Section[]>();
  for (const s of sections) {
    const arr = sectionsByBudget.get(s.budget_id) ?? [];
    arr.push(s);
    sectionsByBudget.set(s.budget_id, arr);
  }

  const sectionIds = sections.map((s) => s.id);
  type Item = { id: string; section_id: string; qty: number | null; internal_unit_price: number | null; internal_total: number | null; bdi_percentage: number | null };
  let items: Item[] = [];
  if (sectionIds.length) {
    const { data: itemsRaw, error: itemsErr } = await admin
      .from("items")
      .select("id, section_id, qty, internal_unit_price, internal_total, bdi_percentage")
      .in("section_id", sectionIds);
    if (itemsErr) throw itemsErr;
    items = (itemsRaw ?? []) as Item[];
  }

  const itemsBySection = new Map<string, Item[]>();
  for (const it of items) {
    const arr = itemsBySection.get(it.section_id) ?? [];
    arr.push(it);
    itemsBySection.set(it.section_id, arr);
  }

  for (const b of budgets) {
    const protectedStatus = PROTECTED_STATUSES.includes(b.internal_status);
    let beforeTotal = 0;
    let afterTotal = 0;
    let touchedItems = 0;
    let touchedSections = 0;

    const secs = sectionsByBudget.get(b.id) ?? [];
    for (const s of secs) {
      const sectionQty = Number(s.qty) || 1;
      const its = itemsBySection.get(s.id) ?? [];
      let secBefore = 0;
      let secAfter = 0;
      if (its.length > 0) {
        for (const it of its) {
          const sale = calcItemSale(it);
          secBefore += sale;
          if (sale > 0) {
            secAfter += sale * factor;
            touchedItems++;
          } else {
            secAfter += sale;
          }
        }
        beforeTotal += secBefore * sectionQty;
        afterTotal += secAfter * sectionQty;
      } else if (s.section_price) {
        beforeTotal += Number(s.section_price) * sectionQty;
        afterTotal += Number(s.section_price) * factor * sectionQty;
        touchedSections++;
      }
    }

    rows.push({
      budget_id: b.id,
      sequential_code: b.sequential_code,
      client_name: b.client_name,
      project_name: b.project_name,
      current_status: b.internal_status,
      before_total: Math.round(beforeTotal * 100) / 100,
      after_total: Math.round(afterTotal * 100) / 100,
      delta: Math.round((afterTotal - beforeTotal) * 100) / 100,
      changes_summary: protectedStatus
        ? "Bloqueado (status protegido)"
        : `${touchedItems} itens · ${touchedSections} seções (preço lump-sum)`,
      protected: protectedStatus,
    });
  }
  return { rows, factor };
}

function buildStatusPlan(
  budgets: Array<{ id: string; sequential_code: string | null; client_name: string; project_name: string; internal_status: string }>,
  newStatus: string,
): PlanRow[] {
  return budgets.map((b) => {
    const protectedStatus = PROTECTED_STATUSES.includes(b.internal_status);
    return {
      budget_id: b.id,
      sequential_code: b.sequential_code,
      client_name: b.client_name,
      project_name: b.project_name,
      current_status: b.internal_status,
      before_total: 0,
      after_total: 0,
      delta: 0,
      changes_summary: protectedStatus
        ? "Bloqueado (status protegido)"
        : `${b.internal_status} → ${newStatus}`,
      protected: protectedStatus,
    };
  });
}

async function buildAssignPlan(
  admin: ReturnType<typeof createClient>,
  budgets: Array<{ id: string; sequential_code: string | null; client_name: string; project_name: string; internal_status: string; commercial_owner_id: string | null; estimator_owner_id: string | null }>,
  role: "commercial" | "estimator",
  ownerName: string,
): Promise<{ rows: PlanRow[]; ownerId: string; ownerLabel: string }> {
  const { data: members, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", `%${ownerName}%`)
    .limit(2);
  if (error) throw error;
  if (!members || members.length === 0) throw new Error(`Nenhum membro encontrado com o nome "${ownerName}".`);
  if (members.length > 1) throw new Error(`Mais de um membro corresponde a "${ownerName}". Seja mais específico.`);

  const ownerId = members[0].id as string;
  const ownerLabel = (members[0].full_name as string) ?? ownerName;
  const field = role === "commercial" ? "commercial_owner_id" : "estimator_owner_id";

  const rows = budgets.map((b) => {
    const protectedStatus = PROTECTED_STATUSES.includes(b.internal_status);
    const currentOwner = b[field as keyof typeof b] as string | null;
    return {
      budget_id: b.id,
      sequential_code: b.sequential_code,
      client_name: b.client_name,
      project_name: b.project_name,
      current_status: b.internal_status,
      before_total: 0,
      after_total: 0,
      delta: 0,
      changes_summary: protectedStatus
        ? "Bloqueado (status protegido)"
        : currentOwner === ownerId
          ? "Já é o responsável"
          : `${role === "commercial" ? "Comercial" : "Orçamentista"} → ${ownerLabel}`,
      protected: protectedStatus,
    };
  });

  return { rows, ownerId, ownerLabel };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return errorResponse("Não autenticado.", 401);

    // Identify the user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return errorResponse("Sessão inválida.", 401);
    const userId = userData.user.id;

    // Service-role client for admin checks + writes
    const admin = createClient(supabaseUrl, serviceKey);

    // Admin check
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) return errorResponse(`Erro ao validar papel: ${roleErr.message}`, 500);
    if (!isAdmin) return errorResponse("Apenas administradores podem executar operações em lote.", 403);

    const body = await req.json();
    const action = body?.action as "plan" | "apply" | "revert" | undefined;
    if (!action) return errorResponse("Campo 'action' obrigatório.");

    // ---------- PLAN ----------
    if (action === "plan") {
      const command = String(body?.command ?? "").trim();
      if (!command) return errorResponse("Comando vazio.");
      if (command.length > 1000) return errorResponse("Comando muito longo (máx 1000 chars).");

      const today = new Date().toISOString().slice(0, 10);
      const parsed = await callAIPlanner(command, today);

      if (parsed.action_type === "unsupported") {
        return jsonResponse({
          ok: false,
          unsupported: true,
          summary: parsed.summary,
          reasoning: parsed.reasoning ?? "",
        });
      }

      const createdFrom = validateDate(parsed.filters?.created_from);
      if (!createdFrom) return errorResponse("Filtro de data inicial obrigatório (YYYY-MM-DD).");
      const createdTo = validateDate(parsed.filters?.created_to);

      // Fetch matching budgets
      let q = admin
        .from("budgets")
        .select("id, sequential_code, client_name, project_name, internal_status, commercial_owner_id, estimator_owner_id")
        .gte("created_at", `${createdFrom}T00:00:00Z`);
      if (createdTo) q = q.lte("created_at", `${createdTo}T23:59:59Z`);
      const { data: budgets, error: bErr } = await q.order("created_at", { ascending: false }).limit(MAX_AFFECTED + 1);
      if (bErr) return errorResponse(`Falha ao buscar orçamentos: ${bErr.message}`, 500);

      if (!budgets || budgets.length === 0) {
        return jsonResponse({
          ok: false,
          empty: true,
          summary: parsed.summary,
          filters: { created_from: createdFrom, created_to: createdTo },
        });
      }
      if (budgets.length > MAX_AFFECTED) {
        return errorResponse(`O comando afetaria mais de ${MAX_AFFECTED} orçamentos (limite por operação). Refine o filtro.`, 400);
      }

      let rows: PlanRow[] = [];
      let extra: Record<string, unknown> = {};

      if (parsed.action_type === "financial_adjustment") {
        const p = parsed.params as { mode?: Mode; value?: number; direction?: "increase" | "decrease" };
        if (!p.mode || typeof p.value !== "number" || !p.direction) {
          return errorResponse("Parâmetros financeiros incompletos (mode, value, direction).");
        }
        if (p.value <= 0 || p.value > 90) return errorResponse("Percentual deve estar entre 0 e 90.");
        const result = await buildFinancialPlan(admin, budgets, { mode: p.mode, value: p.value, direction: p.direction });
        rows = result.rows;
        extra.factor = result.factor;
      } else if (parsed.action_type === "status_change") {
        const newStatus = String(parsed.params?.new_status ?? "");
        if (!newStatus) return errorResponse("new_status obrigatório.");
        if (PROTECTED_STATUSES.includes(newStatus)) return errorResponse(`Não é permitido mover para '${newStatus}' em lote.`);
        rows = buildStatusPlan(budgets, newStatus);
        extra.new_status = newStatus;
      } else if (parsed.action_type === "assign_owner") {
        const p = parsed.params as { role?: "commercial" | "estimator"; owner_name?: string };
        if (!p.role || !p.owner_name) return errorResponse("role e owner_name obrigatórios.");
        const result = await buildAssignPlan(admin, budgets, p.role, p.owner_name);
        rows = result.rows;
        extra.owner_id = result.ownerId;
        extra.owner_label = result.ownerLabel;
        extra.role = p.role;
      }

      const applicableCount = rows.filter((r) => !r.protected).length;
      const protectedCount = rows.length - applicableCount;

      // Persist as pending operation
      const { data: op, error: opErr } = await admin
        .from("ai_bulk_operations")
        .insert({
          admin_id: userId,
          command,
          action_type: parsed.action_type,
          filters: { created_from: createdFrom, created_to: createdTo },
          params: { ...(parsed.params ?? {}), ...extra },
          plan: rows,
          affected_count: applicableCount,
          status: "pending",
        })
        .select("id")
        .single();
      if (opErr) return errorResponse(`Falha ao salvar plano: ${opErr.message}`, 500);

      return jsonResponse({
        ok: true,
        operation_id: op.id,
        action_type: parsed.action_type,
        summary: parsed.summary,
        reasoning: parsed.reasoning ?? "",
        filters: { created_from: createdFrom, created_to: createdTo },
        params: { ...(parsed.params ?? {}), ...extra },
        rows,
        applicable_count: applicableCount,
        protected_count: protectedCount,
        total_before: rows.reduce((s, r) => s + r.before_total, 0),
        total_after: rows.reduce((s, r) => s + r.after_total, 0),
      });
    }

    // ---------- APPLY ----------
    if (action === "apply") {
      const opId = String(body?.operation_id ?? "");
      if (!opId) return errorResponse("operation_id obrigatório.");

      const { data: op, error: opErr } = await admin
        .from("ai_bulk_operations")
        .select("*")
        .eq("id", opId)
        .single();
      if (opErr || !op) return errorResponse("Operação não encontrada.", 404);
      if (op.admin_id !== userId) return errorResponse("Você não pode aplicar uma operação criada por outro admin.", 403);
      if (op.status !== "pending") return errorResponse(`Operação já está '${op.status}'.`);

      const rows = (op.plan as PlanRow[]).filter((r) => !r.protected);
      if (rows.length === 0) return errorResponse("Nada a aplicar (todos os orçamentos estão protegidos).");

      const ids = rows.map((r) => r.budget_id);

      // ---- Snapshot (always) ----
      const snapshot: Record<string, unknown> = { taken_at: new Date().toISOString() };

      if (op.action_type === "financial_adjustment") {
        // Snapshot items (only those that contribute to sale)
        const { data: secs } = await admin.from("sections").select("id, budget_id").in("budget_id", ids);
        const secIds = (secs ?? []).map((s) => s.id);
        const { data: items } = secIds.length
          ? await admin.from("items").select("id, internal_unit_price, internal_total").in("section_id", secIds)
          : { data: [] };
        const { data: sectionPrices } = await admin.from("sections").select("id, section_price").in("id", secIds);
        snapshot.items = items ?? [];
        snapshot.section_prices = sectionPrices ?? [];
      } else if (op.action_type === "status_change") {
        const { data: snap } = await admin.from("budgets").select("id, internal_status").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "assign_owner") {
        const { data: snap } = await admin.from("budgets").select("id, commercial_owner_id, estimator_owner_id").in("id", ids);
        snapshot.budgets = snap ?? [];
      }

      // ---- Apply ----
      let applied = 0;
      try {
        if (op.action_type === "financial_adjustment") {
          const factor = (op.params as { factor: number }).factor;
          const { data: secs } = await admin.from("sections").select("id, budget_id, section_price").in("budget_id", ids);
          const secIds = (secs ?? []).map((s) => s.id);
          const { data: items } = secIds.length
            ? await admin.from("items").select("id, internal_unit_price, internal_total").in("section_id", secIds)
            : { data: [] };

          for (const it of items ?? []) {
            if (it.internal_unit_price && it.internal_unit_price > 0) {
              await admin.from("items").update({ internal_unit_price: Number(it.internal_unit_price) * factor }).eq("id", it.id);
              applied++;
            } else if (it.internal_total && it.internal_total > 0) {
              await admin.from("items").update({ internal_total: Number(it.internal_total) * factor }).eq("id", it.id);
              applied++;
            }
          }
          // Also adjust lump-sum sections (no items)
          const sectionsWithItems = new Set((items ?? []).map((i) => i.section_id));
          for (const s of secs ?? []) {
            if (!sectionsWithItems.has(s.id) && s.section_price) {
              await admin.from("sections").update({ section_price: Number(s.section_price) * factor }).eq("id", s.id);
            }
          }
        } else if (op.action_type === "status_change") {
          const newStatus = (op.params as { new_status: string }).new_status;
          const { error } = await admin
            .from("budgets")
            .update({ internal_status: newStatus })
            .in("id", ids)
            .not("internal_status", "in", `(${PROTECTED_STATUSES.map((s) => `"${s}"`).join(",")})`);
          if (error) throw error;
          applied = ids.length;
        } else if (op.action_type === "assign_owner") {
          const ownerId = (op.params as { owner_id: string }).owner_id;
          const role = (op.params as { role: "commercial" | "estimator" }).role;
          const field = role === "commercial" ? "commercial_owner_id" : "estimator_owner_id";
          const { error } = await admin
            .from("budgets")
            .update({ [field]: ownerId })
            .in("id", ids);
          if (error) throw error;
          applied = ids.length;
        }

        // Log event per budget
        const events = ids.map((bid) => ({
          budget_id: bid,
          event_type: "ai_bulk_operation",
          note: op.command,
          metadata: { operation_id: op.id, action_type: op.action_type },
          user_id: userId,
        }));
        if (events.length) await admin.from("budget_events").insert(events);

        await admin
          .from("ai_bulk_operations")
          .update({
            status: "applied",
            snapshot,
            applied_at: new Date().toISOString(),
          })
          .eq("id", opId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin
          .from("ai_bulk_operations")
          .update({ status: "failed", error_message: msg })
          .eq("id", opId);
        throw e;
      }

      return jsonResponse({ ok: true, operation_id: opId, applied_count: applied });
    }

    // ---------- REVERT ----------
    if (action === "revert") {
      const opId = String(body?.operation_id ?? "");
      if (!opId) return errorResponse("operation_id obrigatório.");

      const { data: op, error: opErr } = await admin
        .from("ai_bulk_operations")
        .select("*")
        .eq("id", opId)
        .single();
      if (opErr || !op) return errorResponse("Operação não encontrada.", 404);
      if (op.status !== "applied") return errorResponse(`Operação está '${op.status}', não pode ser revertida.`);
      if (!op.snapshot) return errorResponse("Snapshot ausente — reversão impossível.");

      const snap = op.snapshot as {
        items?: Array<{ id: string; internal_unit_price: number | null; internal_total: number | null }>;
        section_prices?: Array<{ id: string; section_price: number | null }>;
        budgets?: Array<{ id: string; internal_status?: string; commercial_owner_id?: string | null; estimator_owner_id?: string | null }>;
      };

      if (op.action_type === "financial_adjustment") {
        for (const it of snap.items ?? []) {
          await admin.from("items").update({
            internal_unit_price: it.internal_unit_price,
            internal_total: it.internal_total,
          }).eq("id", it.id);
        }
        for (const s of snap.section_prices ?? []) {
          await admin.from("sections").update({ section_price: s.section_price }).eq("id", s.id);
        }
      } else if (op.action_type === "status_change") {
        for (const b of snap.budgets ?? []) {
          await admin.from("budgets").update({ internal_status: b.internal_status }).eq("id", b.id);
        }
      } else if (op.action_type === "assign_owner") {
        for (const b of snap.budgets ?? []) {
          const patch: Record<string, string | null> = {};
          if ("commercial_owner_id" in b) patch.commercial_owner_id = b.commercial_owner_id ?? null;
          if ("estimator_owner_id" in b) patch.estimator_owner_id = b.estimator_owner_id ?? null;
          await admin.from("budgets").update(patch).eq("id", b.id);
        }
      }

      await admin
        .from("ai_bulk_operations")
        .update({ status: "reverted", reverted_at: new Date().toISOString(), reverted_by: userId })
        .eq("id", opId);

      return jsonResponse({ ok: true, operation_id: opId });
    }

    return errorResponse("Ação inválida.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-bulk-operations error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});
