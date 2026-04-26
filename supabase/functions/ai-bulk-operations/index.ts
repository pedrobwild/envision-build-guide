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
- O filtro de data (\`created_from\` / \`created_to\`) é **opcional**. Se o admin não mencionar data, deixe ambos vazios — o sistema vai considerar TODOS os orçamentos elegíveis, respeitando os status protegidos automaticamente.
- Se o admin disser "todos", "todos os orçamentos", "no sistema", "geral", NÃO invente data: deixe \`filters\` vazio.
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

// Per-request correlation context (set inside the handler before any response).
let _currentRequestId = "";
function setRequestId(id: string) { _currentRequestId = id; }

function jsonResponse(body: unknown, status = 200) {
  const payload = body && typeof body === "object" && !Array.isArray(body)
    ? { request_id: _currentRequestId, ...(body as Record<string, unknown>) }
    : body;
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-request-id": _currentRequestId,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function logCtx(...parts: unknown[]) {
  console.log(`[ai-bulk-operations][req=${_currentRequestId}]`, ...parts);
}
function errCtx(...parts: unknown[]) {
  console.error(`[ai-bulk-operations][req=${_currentRequestId}]`, ...parts);
}

/** Normalize any thrown value (PostgrestError, plain object, string) to an Error. */
function toError(e: unknown, prefix = ""): Error {
  if (e instanceof Error) return prefix ? new Error(`${prefix}: ${e.message}`) : e;
  if (e && typeof e === "object") {
    const obj = e as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [obj.message, obj.details, obj.hint && `hint: ${obj.hint}`, obj.code && `code: ${obj.code}`]
      .filter(Boolean)
      .join(" · ");
    return new Error(prefix ? `${prefix}: ${parts || JSON.stringify(e)}` : parts || JSON.stringify(e));
  }
  return new Error(prefix ? `${prefix}: ${String(e)}` : String(e));
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
  if (secErr) throw toError(secErr, "sections");
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
    if (itemsErr) throw toError(itemsErr, "items");
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
  // deno-lint-ignore no-explicit-any
  admin: any,
  budgets: Array<{ id: string; sequential_code: string | null; client_name: string; project_name: string; internal_status: string; commercial_owner_id: string | null; estimator_owner_id: string | null }>,
  role: "commercial" | "estimator",
  ownerName: string,
): Promise<{ rows: PlanRow[]; ownerId: string; ownerLabel: string }> {
  const { data: members, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", `%${ownerName}%`)
    .limit(2);
  if (error) throw toError(error, "profiles");
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

// =====================================================================
// Versioning helpers (financial_adjustment): clone the budget, copy all
// dependent rows, then apply the factor to the NEW version. The new version
// is forced to internal_status = 'delivered_to_sales' ("Entregue ao Comercial")
// so the commercial team can immediately reshare the public link with clients.
// The OLD version stays intact (snapshot points to it for revert).
// =====================================================================

// Status pós-redução: estado padrão "pronto para reenviar o link ao cliente".
const POST_REDUCTION_STATUS = "delivered_to_sales";

interface VersionCloneResult {
  new_budget_id: string;
  old_budget_id: string;
  old_was_current: boolean;
  old_internal_status: string;
  section_id_map: Record<string, string>;
  item_id_map: Record<string, string>;
}

// deno-lint-ignore no-explicit-any
async function cloneBudgetAsNewVersion(admin: any, sourceBudgetId: string, userId: string, changeReason: string): Promise<VersionCloneResult> {
  const { data: source, error: srcErr } = await admin
    .from("budgets")
    .select("*")
    .eq("id", sourceBudgetId)
    .single();
  if (srcErr || !source) throw toError(srcErr ?? new Error("source-not-found"), `clone:${sourceBudgetId}`);

  let groupId = source.version_group_id as string | null;
  if (!groupId) {
    groupId = sourceBudgetId;
    const { error: ensureErr } = await admin
      .from("budgets")
      .update({ version_group_id: groupId, version_number: 1, is_current_version: true })
      .eq("id", sourceBudgetId);
    if (ensureErr) throw toError(ensureErr, `ensure-group:${sourceBudgetId}`);
  }

  const { data: maxRow } = await admin
    .from("budgets")
    .select("version_number")
    .eq("version_group_id", groupId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((maxRow?.version_number as number | null) ?? 0) + 1;

  // Strip unique / lifecycle fields so the clone gets a fresh identity.
  const {
    id: _id, created_at: _ca, updated_at: _ua, public_id: _pid, public_token_hash: _pth,
    view_count: _vc, last_viewed_at: _lva, approved_at: _aa, approved_by_name: _aby,
    generated_at: _ga, is_published_version: _ipv, sequential_code: _sc,
    closed_at: _cl, contract_file_url: _cfu, budget_pdf_url: _bpu,
    version_group_id: _vg, version_number: _vn, is_current_version: _icv,
    parent_budget_id: _pbid, change_reason: _cr, status: _st, created_by: _cb,
    internal_status: _is,
    ...meta
  } = source;

  const { data: newBudget, error: insErr } = await admin
    .from("budgets")
    .insert({
      ...meta,
      version_group_id: groupId,
      version_number: nextVersion,
      is_current_version: false,
      is_published_version: false,
      parent_budget_id: sourceBudgetId,
      change_reason: changeReason,
      versao: `${nextVersion}`,
      status: "draft",
      created_by: userId,
      view_count: 0,
      // Coloca a nova versão em "Entregue ao Comercial" para reenvio do link.
      internal_status: POST_REDUCTION_STATUS,
    })
    .select("id")
    .single();
  if (insErr || !newBudget) throw toError(insErr ?? new Error("insert-failed"), `clone-insert:${sourceBudgetId}`);
  const newBudgetId = newBudget.id as string;

  await admin
    .from("budgets")
    .update({ is_current_version: false })
    .eq("version_group_id", groupId)
    .neq("id", newBudgetId);
  await admin
    .from("budgets")
    .update({ is_current_version: true })
    .eq("id", newBudgetId);

  const { data: oldSections } = await admin
    .from("sections")
    .select("*")
    .eq("budget_id", sourceBudgetId)
    .order("order_index");

  const sectionIdMap: Record<string, string> = {};
  const itemIdMap: Record<string, string> = {};

  if (oldSections && oldSections.length > 0) {
    const sectionInserts = oldSections.map(({ id: _sid, created_at: _sca, budget_id: _sbid, ...rest }: Record<string, unknown>) => ({
      ...rest,
      budget_id: newBudgetId,
    }));
    const { data: newSections, error: secInsErr } = await admin
      .from("sections")
      .insert(sectionInserts)
      .select("id");
    if (secInsErr) throw toError(secInsErr, `clone-sections:${sourceBudgetId}`);
    (newSections ?? []).forEach((ns: { id: string }, i: number) => {
      const old = oldSections[i];
      if (old?.id && ns?.id) sectionIdMap[old.id as string] = ns.id;
    });

    const oldSectionIds = oldSections.map((s: { id: string }) => s.id);
    const { data: oldItems } = await admin
      .from("items")
      .select("*")
      .in("section_id", oldSectionIds)
      .order("order_index");
    if (oldItems && oldItems.length > 0) {
      const itemInserts = oldItems.map(({ id: _iid, created_at: _ica, section_id: sid, ...rest }: Record<string, unknown>) => ({
        ...rest,
        section_id: sectionIdMap[sid as string] ?? sid,
      }));
      const { data: newItems, error: itemInsErr } = await admin
        .from("items")
        .insert(itemInserts)
        .select("id");
      if (itemInsErr) throw toError(itemInsErr, `clone-items:${sourceBudgetId}`);
      (newItems ?? []).forEach((ni: { id: string }, i: number) => {
        const old = oldItems[i];
        if (old?.id && ni?.id) itemIdMap[old.id as string] = ni.id;
      });

      // Best-effort copy of item images
      try {
        const oldItemIds = oldItems.map((it: { id: string }) => it.id);
        const { data: oldImages } = await admin
          .from("item_images")
          .select("*")
          .in("item_id", oldItemIds);
        if (oldImages && oldImages.length > 0) {
          const imageInserts = oldImages.map(({ id: _imgid, created_at: _imgca, item_id: iid, ...rest }: Record<string, unknown>) => ({
            ...rest,
            item_id: itemIdMap[iid as string] ?? iid,
          }));
          await admin.from("item_images").insert(imageInserts);
        }
      } catch (e) {
        errCtx(`clone-item-images skipped for ${sourceBudgetId}: ${toError(e).message}`);
      }
    }
  }

  // Best-effort clone of adjustments
  try {
    const { data: adj } = await admin.from("adjustments").select("*").eq("budget_id", sourceBudgetId);
    if (adj && adj.length > 0) {
      await admin.from("adjustments").insert(
        adj.map(({ id: _aid, created_at: _aca, budget_id: _abid, ...rest }: Record<string, unknown>) => ({
          ...rest,
          budget_id: newBudgetId,
        })),
      );
    }
  } catch (e) {
    errCtx(`clone-adjustments skipped for ${sourceBudgetId}: ${toError(e).message}`);
  }

  try {
    await admin.from("budget_events").insert({
      budget_id: newBudgetId,
      event_type: "version_created",
      note: changeReason,
      metadata: {
        source: "ai_bulk_operation",
        source_budget_id: sourceBudgetId,
        version_number: nextVersion,
      },
      user_id: userId,
    });
  } catch {
    /* non-fatal */
  }

  return {
    new_budget_id: newBudgetId,
    old_budget_id: sourceBudgetId,
    old_was_current: Boolean((source as { is_current_version?: boolean }).is_current_version),
    old_internal_status: String((source as { internal_status?: string }).internal_status ?? ""),
    section_id_map: sectionIdMap,
    item_id_map: itemIdMap,
  };
}

serve(async (req) => {
  // Correlation ID: use header from client, body field, or generate one.
  const headerReqId = req.headers.get("x-request-id") ?? "";
  const reqId = headerReqId || crypto.randomUUID();
  setRequestId(reqId);

  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "x-request-id": reqId } });

  const startedAt = Date.now();
  logCtx(`→ ${req.method} ${new URL(req.url).pathname}`);

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
    // If client provided request_id in body and we generated one ourselves, prefer the client's.
    if (!headerReqId && typeof body?.request_id === "string" && body.request_id.length > 0 && body.request_id.length <= 64) {
      setRequestId(body.request_id);
    }
    const action = body?.action as "plan" | "apply" | "revert" | undefined;
    logCtx(`action=${action} user=${userId}${body?.operation_id ? ` op=${body.operation_id}` : ""}`);
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
      const createdTo = validateDate(parsed.filters?.created_to);

      // Fetch matching budgets (date filters are optional — when absent, scan all)
      let q = admin
        .from("budgets")
        .select("id, sequential_code, client_name, project_name, internal_status, commercial_owner_id, estimator_owner_id");
      if (createdFrom) q = q.gte("created_at", `${createdFrom}T00:00:00Z`);
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
        // For financial reductions we clone each budget into a NEW version
        // (so the snapshot/revert just needs to know which clones to delete
        // and which old versions to restore as current). The old budget rows
        // stay untouched, so we don't snapshot their items/sections anymore.
        const { data: snap } = await admin
          .from("budgets")
          .select("id, internal_status, is_current_version, version_group_id")
          .in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "status_change") {
        const { data: snap } = await admin.from("budgets").select("id, internal_status").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "assign_owner") {
        const { data: snap } = await admin.from("budgets").select("id, commercial_owner_id, estimator_owner_id").in("id", ids);
        snapshot.budgets = snap ?? [];
      }

      // ---- Apply ----
      let applied = 0;
      const updateErrors: Array<{ id: string; error: string }> = [];
      // Helper: run promises in chunks to avoid exhausting connections.
      async function runInChunks<T>(arr: T[], chunkSize: number, worker: (item: T) => Promise<void>) {
        for (let i = 0; i < arr.length; i += chunkSize) {
          const slice = arr.slice(i, i + chunkSize);
          await Promise.all(slice.map(worker));
        }
      }

      try {
        if (op.action_type === "financial_adjustment") {
          const factor = (op.params as { factor: number }).factor;
          if (typeof factor !== "number" || !isFinite(factor) || factor <= 0) {
            throw new Error(`Fator inválido no plano: ${factor}`);
          }

          // ---- 1) Clone each source budget into a new version ----
          // Sequential pacing inside each chunk avoids overwhelming the DB
          // pool when there are dozens of nested inserts (sections + items +
          // images + adjustments per budget). 4 in flight is conservative.
          const clones: VersionCloneResult[] = [];
          const cloneFailures: Array<{ id: string; error: string }> = [];
          const changeReason = `Redução em lote · ${op.command.slice(0, 180)}`;

          await runInChunks(ids, 4, async (sourceId) => {
            try {
              const result = await cloneBudgetAsNewVersion(admin, sourceId, userId, changeReason);
              clones.push(result);
            } catch (e) {
              const msg = toError(e).message;
              cloneFailures.push({ id: sourceId, error: msg });
              errCtx(`clone failed for ${sourceId}: ${msg}`);
            }
          });

          if (clones.length === 0) {
            throw new Error(
              `Nenhuma versão pôde ser criada (${cloneFailures.length} falhas). ${cloneFailures[0]?.error ?? ""}`,
            );
          }

          // Persist clone mapping in the snapshot for revert.
          (snapshot as Record<string, unknown>).clones = clones.map((c) => ({
            old_budget_id: c.old_budget_id,
            new_budget_id: c.new_budget_id,
            old_was_current: c.old_was_current,
            old_internal_status: c.old_internal_status,
          }));
          if (cloneFailures.length > 0) {
            updateErrors.push(...cloneFailures);
          }

          // ---- 2) Apply the factor on the NEW versions only ----
          const newBudgetIds = clones.map((c) => c.new_budget_id);

          const { data: newSecs, error: newSecsErr } = await admin
            .from("sections")
            .select("id, budget_id, section_price")
            .in("budget_id", newBudgetIds);
          if (newSecsErr) throw toError(newSecsErr, "new-sections-read");
          const newSecIds = (newSecs ?? []).map((s: { id: string }) => s.id);

          let newItems: Array<{ id: string; section_id: string; internal_unit_price: number | null; internal_total: number | null }> = [];
          if (newSecIds.length) {
            const { data: itemsRaw, error: itemsErr } = await admin
              .from("items")
              .select("id, section_id, internal_unit_price, internal_total")
              .in("section_id", newSecIds);
            if (itemsErr) throw toError(itemsErr, "new-items-read");
            newItems = (itemsRaw ?? []) as typeof newItems;
          }

          logCtx(`apply-financial: cloned ${clones.length} budgets · ${newItems.length} new items · ${newSecs?.length ?? 0} new sections · factor=${factor}`);

          await runInChunks(newItems, 24, async (it) => {
            try {
              if (it.internal_unit_price && it.internal_unit_price > 0) {
                const { error } = await admin
                  .from("items")
                  .update({ internal_unit_price: Number(it.internal_unit_price) * factor })
                  .eq("id", it.id);
                if (error) {
                  updateErrors.push({ id: it.id, error: toError(error).message });
                  return;
                }
                applied++;
              } else if (it.internal_total && it.internal_total > 0) {
                const { error } = await admin
                  .from("items")
                  .update({ internal_total: Number(it.internal_total) * factor })
                  .eq("id", it.id);
                if (error) {
                  updateErrors.push({ id: it.id, error: toError(error).message });
                  return;
                }
                applied++;
              }
            } catch (e) {
              updateErrors.push({ id: it.id, error: toError(e).message });
            }
          });

          const sectionsWithItems = new Set(newItems.map((i) => i.section_id));
          const lumpSections = ((newSecs ?? []) as Array<{ id: string; section_price: number | null }>).filter(
            (s) => !sectionsWithItems.has(s.id) && s.section_price && Number(s.section_price) > 0
          );
          await runInChunks(lumpSections, 24, async (s) => {
            try {
              const { error } = await admin
                .from("sections")
                .update({ section_price: Number(s.section_price) * factor })
                .eq("id", s.id);
              if (error) updateErrors.push({ id: s.id, error: toError(error).message });
            } catch (e) {
              updateErrors.push({ id: s.id, error: toError(e).message });
            }
          });

          if (updateErrors.length > 0) {
            errCtx(`apply-financial: ${updateErrors.length} updates falharam`, updateErrors.slice(0, 5));
          }
        } else if (op.action_type === "status_change") {
          const newStatus = (op.params as { new_status: string }).new_status;
          const { error } = await admin
            .from("budgets")
            .update({ internal_status: newStatus })
            .in("id", ids);
          if (error) throw toError(error, "status_change");
          applied = ids.length;
        } else if (op.action_type === "assign_owner") {
          const ownerId = (op.params as { owner_id: string }).owner_id;
          const role = (op.params as { role: "commercial" | "estimator" }).role;
          const field = role === "commercial" ? "commercial_owner_id" : "estimator_owner_id";
          const { error } = await admin
            .from("budgets")
            .update({ [field]: ownerId })
            .in("id", ids);
          if (error) throw toError(error, "assign_owner");
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
        const normalized = toError(e);
        await admin
          .from("ai_bulk_operations")
          .update({ status: "failed", error_message: normalized.message })
          .eq("id", opId);
        throw normalized;
      }

      return jsonResponse({
        ok: true,
        operation_id: opId,
        applied_count: applied,
        partial_failures: updateErrors.length,
        ...(updateErrors.length > 0 ? { failure_sample: updateErrors.slice(0, 3) } : {}),
      });
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
        clones?: Array<{ old_budget_id: string; new_budget_id: string; old_was_current: boolean; old_internal_status: string }>;
      };

      if (op.action_type === "financial_adjustment") {
        // New revert path: delete the cloned versions and restore the old
        // versions as current. Falls back to the legacy in-place revert (for
        // operations applied before this change) when no clone map is present.
        if (snap.clones && snap.clones.length > 0) {
          const newIds = snap.clones.map((c) => c.new_budget_id);

          // Cascade delete dependents of the cloned budgets, in dependency order.
          const { data: cloneSecs } = await admin
            .from("sections")
            .select("id")
            .in("budget_id", newIds);
          const cloneSecIds = (cloneSecs ?? []).map((s: { id: string }) => s.id);
          if (cloneSecIds.length > 0) {
            const { data: cloneItems } = await admin
              .from("items")
              .select("id")
              .in("section_id", cloneSecIds);
            const cloneItemIds = (cloneItems ?? []).map((i: { id: string }) => i.id);
            if (cloneItemIds.length > 0) {
              try { await admin.from("item_images").delete().in("item_id", cloneItemIds); } catch { /* ignore */ }
              await admin.from("items").delete().in("id", cloneItemIds);
            }
            await admin.from("sections").delete().in("id", cloneSecIds);
          }
          try { await admin.from("adjustments").delete().in("budget_id", newIds); } catch { /* ignore */ }
          try { await admin.from("rooms").delete().in("budget_id", newIds); } catch { /* ignore */ }
          try { await admin.from("budget_tours").delete().in("budget_id", newIds); } catch { /* ignore */ }
          try { await admin.from("budget_events").delete().in("budget_id", newIds); } catch { /* ignore */ }
          await admin.from("budgets").delete().in("id", newIds);

          // Restore the old versions as current and reset their internal_status
          // to whatever it was before the bulk operation.
          for (const c of snap.clones) {
            await admin
              .from("budgets")
              .update({
                is_current_version: c.old_was_current,
                internal_status: c.old_internal_status || "novo",
              })
              .eq("id", c.old_budget_id);
          }
        } else {
          // Legacy fallback (operations applied before clone-based versioning).
          for (const it of snap.items ?? []) {
            await admin.from("items").update({
              internal_unit_price: it.internal_unit_price,
              internal_total: it.internal_total,
            }).eq("id", it.id);
          }
          for (const s of snap.section_prices ?? []) {
            await admin.from("sections").update({ section_price: s.section_price }).eq("id", s.id);
          }
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
    let msg: string;
    if (err instanceof Error) {
      msg = err.message;
    } else if (err && typeof err === "object") {
      try {
        msg = JSON.stringify(err);
      } catch {
        msg = String(err);
      }
    } else {
      msg = String(err);
    }
    errCtx(`✗ FAILED in ${Date.now() - startedAt}ms — ${msg}`, err instanceof Error ? err.stack : "");
    return jsonResponse({ error: msg }, 500);
  } finally {
    logCtx(`← done in ${Date.now() - startedAt}ms`);
  }
});
