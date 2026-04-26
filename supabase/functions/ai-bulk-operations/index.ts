import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
   4. **priority_change**: muda a prioridade. Params: \`new_priority\` ('baixa'|'normal'|'alta'|'urgente'). Aceite sinônimos: 'low'='baixa', 'medium'='normal', 'high'='alta', 'urgent'='urgente'.
   5. **validity_change**: muda o prazo de validade da proposta em dias. Params: \`validity_days\` (inteiro positivo, máx 365).
      Ex.: "estender validade para 60 dias em todos" → validity_days=60.
   6. **due_date_change**: define/altera o prazo interno (\`due_at\`). Params: \`due_date\` (ISO YYYY-MM-DD) OU \`due_in_days\` (inteiro: hoje + N dias). Use \`due_date\` quando o usuário mencionar uma data específica; \`due_in_days\` para "em 7 dias", "para próxima sexta" (calcule).
   7. **pipeline_change**: move para outro pipeline (funil). Params: \`pipeline_name\` (nome aproximado, ex. "Comercial", "Re-engajamento").
   8. **pipeline_stage_change**: move para uma etapa do pipeline atual. Params: \`new_stage\` (uma de: 'lead','briefing','visita','proposta','negociacao'). NÃO use 'fechado' nem 'perdido' aqui (use status_change).
   9. **archive**: arquiva os orçamentos (move para \`internal_status='archived'\`). Sem params adicionais. Use quando o admin disser "arquivar", "remover do funil", "tirar do kanban".
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
          enum: [
            "financial_adjustment",
            "status_change",
            "assign_owner",
            "priority_change",
            "validity_change",
            "due_date_change",
            "pipeline_change",
            "pipeline_stage_change",
            "archive",
            "unsupported",
          ],
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
            new_priority: { type: "string", enum: ["baixa", "normal", "alta", "urgente"] },
            validity_days: { type: "number", description: "Inteiro entre 1 e 365" },
            due_date: { type: "string", description: "Data ISO YYYY-MM-DD" },
            due_in_days: { type: "number", description: "Inteiro: hoje + N dias" },
            pipeline_name: { type: "string", description: "Nome aproximado do pipeline destino" },
            new_stage: { type: "string", enum: ["lead", "briefing", "visita", "proposta", "negociacao"] },
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

type ActionType =
  | "financial_adjustment"
  | "status_change"
  | "assign_owner"
  | "priority_change"
  | "validity_change"
  | "due_date_change"
  | "pipeline_change"
  | "pipeline_stage_change"
  | "archive";
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

/**
 * PostgREST rejects very long URLs (status 400 "Bad Request" with no body details)
 * when an `.in("col", values)` filter contains thousands of UUIDs. We chunk the
 * IN-list and merge the results to stay safely under the URL length limit.
 */
const IN_CHUNK_SIZE = 200;
async function selectInChunks<T>(
  values: string[],
  runChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
  label: string,
): Promise<T[]> {
  if (values.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK_SIZE) {
    const chunk = values.slice(i, i + IN_CHUNK_SIZE);
    const { data, error } = await runChunk(chunk);
    if (error) throw toError(error, label);
    if (data && data.length) out.push(...data);
  }
  return out;
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

  type Section = { id: string; budget_id: string; qty: number | null; section_price: number | null };
  const sections = await selectInChunks<Section>(
    ids,
    (chunk) => admin
      .from("sections")
      .select("id, budget_id, qty, section_price")
      .in("budget_id", chunk),
    "sections",
  );

  const sectionsByBudget = new Map<string, Section[]>();
  for (const s of sections) {
    const arr = sectionsByBudget.get(s.budget_id) ?? [];
    arr.push(s);
    sectionsByBudget.set(s.budget_id, arr);
  }

  const sectionIds = sections.map((s) => s.id);
  type Item = { id: string; section_id: string; qty: number | null; internal_unit_price: number | null; internal_total: number | null; bdi_percentage: number | null };
  const items = await selectInChunks<Item>(
    sectionIds,
    (chunk) => admin
      .from("items")
      .select("id, section_id, qty, internal_unit_price, internal_total, bdi_percentage")
      .in("section_id", chunk),
    "items",
  );

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
// Plain-field bulk builders (priority, validity, due_at, archive,
// pipeline_id, pipeline_stage). All write the new value into a single
// scalar column; revert restores the previous per-row value from snapshot.
// =====================================================================

const PRIORITY_VALUES = new Set(["baixa", "normal", "alta", "urgente"]);
const PRIORITY_ALIASES: Record<string, string> = {
  low: "baixa", baixa: "baixa",
  medium: "normal", normal: "normal",
  high: "alta", alta: "alta",
  urgent: "urgente", urgente: "urgente",
};
const STAGE_VALUES = new Set(["lead", "briefing", "visita", "proposta", "negociacao"]);

function plainPlan(
  budgets: Array<{ id: string; sequential_code: string | null; client_name: string; project_name: string; internal_status: string }>,
  changeLabel: (b: { internal_status: string }) => string,
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
      changes_summary: protectedStatus ? "Bloqueado (status protegido)" : changeLabel(b),
      protected: protectedStatus,
    };
  });
}

function isoDateOrNull(s: string | undefined): string | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function dueInDaysToISO(n: number): string {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 0);
  d.setUTCDate(d.getUTCDate() + Math.round(n));
  return d.toISOString();
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
  old_version_number: number;
  new_version_number: number;
  section_id_map: Record<string, string>;
  item_id_map: Record<string, string>;
}

// Estados em que o orçamento NÃO pode receber redução em lote — protege
// fluxos finalizados ou em fase contratual avançada contra mutações concorrentes.
const CLONE_PROTECTED_STATUSES = new Set([
  "lost",
  "archived",
  "contrato_fechado",
  "minuta_solicitada",
]);

// deno-lint-ignore no-explicit-any
async function cloneBudgetAsNewVersion(admin: any, sourceBudgetId: string, userId: string, changeReason: string, expectedStatus?: string): Promise<VersionCloneResult> {
  const { data: source, error: srcErr } = await admin
    .from("budgets")
    .select("*")
    .eq("id", sourceBudgetId)
    .single();
  if (srcErr || !source) throw toError(srcErr ?? new Error("source-not-found"), `clone:${sourceBudgetId}`);

  const currentStatus = String((source as { internal_status?: string }).internal_status ?? "");

  // Guard 1: estado protegido (mudou para final entre o plan e o apply)
  if (CLONE_PROTECTED_STATUSES.has(currentStatus)) {
    throw new Error(`Orçamento ${sourceBudgetId} está em estado protegido '${currentStatus}' — pulado para evitar conflito.`);
  }

  // Guard 2: divergência entre o estado capturado no plan e o estado atual
  // (alguém moveu o orçamento no kanban entre o plan e o apply). Permitimos
  // mas registramos no result para que o revert preserve fielmente o estado
  // que de fato existia imediatamente antes do clone.
  if (expectedStatus && expectedStatus !== currentStatus) {
    logCtx(`clone:${sourceBudgetId} status drift: plan='${expectedStatus}' actual='${currentStatus}' — usando atual`);
  }

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

  // Guard 3: race com publicação/clone concorrente. Se entre nossa leitura de
  // maxRow e o insert alguém publicou outra versão (que herdou nextVersion ou
  // pulou para nextVersion+1), abortamos: deletamos nosso clone e erramos.
  const { data: postInsertMax } = await admin
    .from("budgets")
    .select("id, version_number")
    .eq("version_group_id", groupId)
    .order("version_number", { ascending: false })
    .limit(2);
  const top = (postInsertMax ?? []) as Array<{ id: string; version_number: number }>;
  // Se houver outra linha com version_number >= nextVersion que não seja a nossa, há colisão.
  const collision = top.find((r) => r.id !== newBudgetId && r.version_number >= nextVersion);
  if (collision) {
    errCtx(`clone:${sourceBudgetId} colisão de versão detectada (v${collision.version_number} já existe) — abortando`);
    try { await admin.from("budgets").delete().eq("id", newBudgetId); } catch { /* ignore */ }
    throw new Error(`Conflito de versão no grupo ${groupId} — outra operação criou v${collision.version_number} simultaneamente.`);
  }

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
    // Usa o status REAL no momento do clone (currentStatus), não o do plan,
    // garantindo que o revert restaure o estado de fato preservado.
    old_internal_status: currentStatus,
    old_version_number: Number((source as { version_number?: number }).version_number ?? 1),
    new_version_number: nextVersion,
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

      // Fetch matching budgets (date filters are optional — when absent, scan all).
      // CRÍTICO: filtra apenas a versão ATUAL de cada grupo (`is_current_version`
      // != false, incluindo NULL para orçamentos legados sem versionamento).
      // Sem este filtro, um clone em batch pode receber duas versões do mesmo
      // grupo em paralelo e disparar falso-positivo na guarda anti-colisão de
      // `cloneBudgetAsNewVersion`.
      let q = admin
        .from("budgets")
        .select("id, sequential_code, client_name, project_name, internal_status, commercial_owner_id, estimator_owner_id, is_current_version")
        .or("is_current_version.is.null,is_current_version.eq.true");
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
      } else if (parsed.action_type === "priority_change") {
        const raw = String(parsed.params?.new_priority ?? "").toLowerCase().trim();
        const normalized = PRIORITY_ALIASES[raw];
        if (!normalized || !PRIORITY_VALUES.has(normalized)) {
          return errorResponse("Prioridade inválida (use baixa, normal, alta ou urgente).");
        }
        rows = plainPlan(budgets, () => `Prioridade → ${normalized}`);
        extra.new_priority = normalized;
      } else if (parsed.action_type === "validity_change") {
        const days = Number(parsed.params?.validity_days);
        if (!Number.isFinite(days) || days < 1 || days > 365) {
          return errorResponse("validity_days deve ser inteiro entre 1 e 365.");
        }
        const intDays = Math.round(days);
        rows = plainPlan(budgets, () => `Validade → ${intDays} dias`);
        extra.validity_days = intDays;
      } else if (parsed.action_type === "due_date_change") {
        const p = parsed.params as { due_date?: string; due_in_days?: number };
        let dueIso: string | null = null;
        let label = "";
        if (p.due_date) {
          dueIso = isoDateOrNull(p.due_date);
          if (!dueIso) return errorResponse("due_date inválida (use YYYY-MM-DD).");
          label = `Prazo → ${p.due_date}`;
        } else if (typeof p.due_in_days === "number" && Number.isFinite(p.due_in_days)) {
          if (p.due_in_days < 0 || p.due_in_days > 365) {
            return errorResponse("due_in_days deve estar entre 0 e 365.");
          }
          dueIso = dueInDaysToISO(p.due_in_days);
          label = `Prazo → hoje + ${Math.round(p.due_in_days)} dias`;
        } else {
          return errorResponse("Informe due_date ou due_in_days.");
        }
        rows = plainPlan(budgets, () => label);
        extra.due_at = dueIso;
      } else if (parsed.action_type === "pipeline_change") {
        const name = String(parsed.params?.pipeline_name ?? "").trim();
        if (!name) return errorResponse("pipeline_name obrigatório.");
        const { data: pipes, error: pErr } = await admin
          .from("deal_pipelines")
          .select("id, name, slug")
          .ilike("name", `%${name}%`)
          .limit(2);
        if (pErr) return errorResponse(`Falha ao buscar pipelines: ${pErr.message}`, 500);
        if (!pipes || pipes.length === 0) return errorResponse(`Nenhum pipeline encontrado com o nome "${name}".`);
        if (pipes.length > 1) return errorResponse(`Mais de um pipeline corresponde a "${name}". Seja mais específico.`);
        const pipeline = pipes[0] as { id: string; name: string };
        rows = plainPlan(budgets, () => `Pipeline → ${pipeline.name}`);
        extra.pipeline_id = pipeline.id;
        extra.pipeline_label = pipeline.name;
      } else if (parsed.action_type === "pipeline_stage_change") {
        const stage = String(parsed.params?.new_stage ?? "").toLowerCase().trim();
        if (!STAGE_VALUES.has(stage)) {
          return errorResponse("new_stage inválido (use lead, briefing, visita, proposta ou negociacao).");
        }
        rows = plainPlan(budgets, () => `Etapa → ${stage}`);
        extra.new_stage = stage;
      } else if (parsed.action_type === "archive") {
        rows = plainPlan(budgets, (b) => `${b.internal_status} → archived`);
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

      // Snapshot do estado ATUAL (re-leitura no momento do apply, não confiando
      // no plan que pode estar stale se houve drift). Mapeia por id para que o
      // clone receba o estado expected vs current e o revert possa preservar.
      const planStatusById = new Map<string, string>();
      if (op.action_type === "financial_adjustment") {
        const { data: snap } = await admin
          .from("budgets")
          .select("id, internal_status, is_current_version, version_group_id")
          .in("id", ids);
        snapshot.budgets = snap ?? [];
        (snap ?? []).forEach((b: { id: string; internal_status: string }) => {
          planStatusById.set(b.id, b.internal_status);
        });
      } else if (op.action_type === "status_change") {
        const { data: snap } = await admin.from("budgets").select("id, internal_status").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "assign_owner") {
        const { data: snap } = await admin.from("budgets").select("id, commercial_owner_id, estimator_owner_id").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "priority_change") {
        const { data: snap } = await admin.from("budgets").select("id, priority").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "validity_change") {
        const { data: snap } = await admin.from("budgets").select("id, validity_days").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "due_date_change") {
        const { data: snap } = await admin.from("budgets").select("id, due_at").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "pipeline_change") {
        const { data: snap } = await admin.from("budgets").select("id, pipeline_id").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "pipeline_stage_change") {
        const { data: snap } = await admin.from("budgets").select("id, pipeline_stage, win_probability").in("id", ids);
        snapshot.budgets = snap ?? [];
      } else if (op.action_type === "archive") {
        const { data: snap } = await admin.from("budgets").select("id, internal_status").in("id", ids);
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
              const expectedStatus = planStatusById.get(sourceId);
              const result = await cloneBudgetAsNewVersion(admin, sourceId, userId, changeReason, expectedStatus);
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
            new_version_number: c.new_version_number,
          }));
          if (cloneFailures.length > 0) {
            updateErrors.push(...cloneFailures);
          }

          // ---- 2) Apply the factor on the NEW versions only ----
          const newBudgetIds = clones.map((c) => c.new_budget_id);

          type NewSec = { id: string; budget_id: string; section_price: number | null };
          const newSecs = await selectInChunks<NewSec>(
            newBudgetIds,
            (chunk) => admin
              .from("sections")
              .select("id, budget_id, section_price")
              .in("budget_id", chunk),
            "new-sections-read",
          );
          const newSecIds = newSecs.map((s) => s.id);

          type NewItem = { id: string; section_id: string; internal_unit_price: number | null; internal_total: number | null };
          const newItems = await selectInChunks<NewItem>(
            newSecIds,
            (chunk) => admin
              .from("items")
              .select("id, section_id, internal_unit_price, internal_total")
              .in("section_id", chunk),
            "new-items-read",
          );

          logCtx(`apply-financial: cloned ${clones.length} budgets · ${newItems.length} new items · ${newSecs.length} new sections · factor=${factor}`);

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
        } else if (op.action_type === "priority_change") {
          const newPriority = (op.params as { new_priority: string }).new_priority;
          const { error } = await admin
            .from("budgets")
            .update({ priority: newPriority })
            .in("id", ids);
          if (error) throw toError(error, "priority_change");
          applied = ids.length;
        } else if (op.action_type === "validity_change") {
          const validityDays = (op.params as { validity_days: number }).validity_days;
          const { error } = await admin
            .from("budgets")
            .update({ validity_days: validityDays })
            .in("id", ids);
          if (error) throw toError(error, "validity_change");
          applied = ids.length;
        } else if (op.action_type === "due_date_change") {
          const dueAt = (op.params as { due_at: string }).due_at;
          const { error } = await admin
            .from("budgets")
            .update({ due_at: dueAt })
            .in("id", ids);
          if (error) throw toError(error, "due_date_change");
          applied = ids.length;
        } else if (op.action_type === "pipeline_change") {
          const pipelineId = (op.params as { pipeline_id: string }).pipeline_id;
          const { error } = await admin
            .from("budgets")
            .update({ pipeline_id: pipelineId })
            .in("id", ids);
          if (error) throw toError(error, "pipeline_change");
          applied = ids.length;
        } else if (op.action_type === "pipeline_stage_change") {
          const newStage = (op.params as { new_stage: string }).new_stage;
          // Update pipeline_stage directly; the existing trigger only re-derives
          // it when internal_status changes, so manual stage moves are honored.
          const { error } = await admin
            .from("budgets")
            .update({ pipeline_stage: newStage })
            .in("id", ids);
          if (error) throw toError(error, "pipeline_stage_change");
          applied = ids.length;
        } else if (op.action_type === "archive") {
          const { error } = await admin
            .from("budgets")
            .update({ internal_status: "archived" })
            .in("id", ids);
          if (error) throw toError(error, "archive");
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
        budgets?: Array<{
          id: string;
          internal_status?: string;
          commercial_owner_id?: string | null;
          estimator_owner_id?: string | null;
          priority?: string;
          validity_days?: number | null;
          due_at?: string | null;
          pipeline_id?: string | null;
          pipeline_stage?: string | null;
          win_probability?: number | null;
        }>;
        clones?: Array<{ old_budget_id: string; new_budget_id: string; old_was_current: boolean; old_internal_status: string; new_version_number?: number }>;
      };

      const revertSkipped: Array<{ id: string; reason: string }> = [];

      if (op.action_type === "financial_adjustment") {
        // New revert path: delete the cloned versions and restore the old
        // versions as current. Falls back to the legacy in-place revert (for
        // operations applied before this change) when no clone map is present.
        if (snap.clones && snap.clones.length > 0) {
          const newIds = snap.clones.map((c) => c.new_budget_id);

          // Concurrency guard: re-leitura do estado atual das versões clonadas.
          // Se alguma foi PUBLICADA, MOVIDA do estado pós-redução, ou já não
          // existe, NÃO devemos deletá-la nem sobrescrever manualmente — pulamos.
          const { data: cloneNow } = await admin
            .from("budgets")
            .select("id, is_published_version, internal_status, status")
            .in("id", newIds);
          const cloneNowById = new Map<string, { is_published_version: boolean; internal_status: string; status: string }>();
          (cloneNow ?? []).forEach((b: { id: string; is_published_version: boolean; internal_status: string; status: string }) => {
            cloneNowById.set(b.id, b);
          });

          const safeClones: typeof snap.clones = [];
          for (const c of snap.clones) {
            const cur = cloneNowById.get(c.new_budget_id);
            if (!cur) {
              revertSkipped.push({ id: c.new_budget_id, reason: "versão clonada já não existe" });
              continue;
            }
            if (cur.is_published_version) {
              revertSkipped.push({ id: c.new_budget_id, reason: "versão clonada foi publicada após o apply" });
              continue;
            }
            if (cur.internal_status !== POST_REDUCTION_STATUS) {
              revertSkipped.push({ id: c.new_budget_id, reason: `versão clonada foi movida para '${cur.internal_status}' após o apply` });
              continue;
            }
            safeClones.push(c);
          }

          const safeNewIds = safeClones.map((c) => c.new_budget_id);

          if (safeNewIds.length > 0) {
            // Cascade delete dependents of the cloned budgets, in dependency order.
            const { data: cloneSecs } = await admin
              .from("sections")
              .select("id")
              .in("budget_id", safeNewIds);
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
            try { await admin.from("adjustments").delete().in("budget_id", safeNewIds); } catch { /* ignore */ }
            try { await admin.from("rooms").delete().in("budget_id", safeNewIds); } catch { /* ignore */ }
            try { await admin.from("budget_tours").delete().in("budget_id", safeNewIds); } catch { /* ignore */ }
            try { await admin.from("budget_events").delete().in("budget_id", safeNewIds); } catch { /* ignore */ }
            await admin.from("budgets").delete().in("id", safeNewIds);
          }

          // Restore each old version individually — só restaura is_current_version
          // se NENHUMA versão posterior tomou o lugar (ex.: nova publicação manual).
          for (const c of safeClones) {
            const { data: oldNow } = await admin
              .from("budgets")
              .select("id, version_group_id, internal_status")
              .eq("id", c.old_budget_id)
              .maybeSingle();
            if (!oldNow) {
              revertSkipped.push({ id: c.old_budget_id, reason: "versão original não encontrada" });
              continue;
            }

            // Verifica se ainda há outra versão current no grupo (ex.: alguém
            // publicou uma nova versão entre o apply e o revert). Nesse caso,
            // só restauramos o internal_status, NUNCA forçamos current.
            let restoreCurrent = c.old_was_current;
            if (restoreCurrent && oldNow.version_group_id) {
              const { data: otherCurrent } = await admin
                .from("budgets")
                .select("id")
                .eq("version_group_id", oldNow.version_group_id)
                .eq("is_current_version", true)
                .neq("id", c.old_budget_id)
                .limit(1);
              if (otherCurrent && otherCurrent.length > 0) {
                restoreCurrent = false;
                revertSkipped.push({ id: c.old_budget_id, reason: "outra versão já é a current — preservada" });
              }
            }

            const patch: Record<string, unknown> = {
              internal_status: c.old_internal_status || "novo",
            };
            if (restoreCurrent) patch.is_current_version = true;

            await admin.from("budgets").update(patch).eq("id", c.old_budget_id);
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
      } else if (op.action_type === "priority_change") {
        for (const b of snap.budgets ?? []) {
          if (b.priority !== undefined) {
            await admin.from("budgets").update({ priority: b.priority }).eq("id", b.id);
          }
        }
      } else if (op.action_type === "validity_change") {
        for (const b of snap.budgets ?? []) {
          if (b.validity_days !== undefined) {
            await admin.from("budgets").update({ validity_days: b.validity_days }).eq("id", b.id);
          }
        }
      } else if (op.action_type === "due_date_change") {
        for (const b of snap.budgets ?? []) {
          if ("due_at" in b) {
            await admin.from("budgets").update({ due_at: b.due_at ?? null }).eq("id", b.id);
          }
        }
      } else if (op.action_type === "pipeline_change") {
        for (const b of snap.budgets ?? []) {
          if ("pipeline_id" in b) {
            await admin.from("budgets").update({ pipeline_id: b.pipeline_id ?? null }).eq("id", b.id);
          }
        }
      } else if (op.action_type === "pipeline_stage_change") {
        for (const b of snap.budgets ?? []) {
          const patch: Record<string, unknown> = {};
          if ("pipeline_stage" in b) patch.pipeline_stage = b.pipeline_stage ?? null;
          if ("win_probability" in b) patch.win_probability = b.win_probability ?? null;
          if (Object.keys(patch).length > 0) {
            await admin.from("budgets").update(patch).eq("id", b.id);
          }
        }
      } else if (op.action_type === "archive") {
        for (const b of snap.budgets ?? []) {
          if (b.internal_status) {
            await admin.from("budgets").update({ internal_status: b.internal_status }).eq("id", b.id);
          }
        }
      }

      await admin
        .from("ai_bulk_operations")
        .update({ status: "reverted", reverted_at: new Date().toISOString(), reverted_by: userId })
        .eq("id", opId);

      return jsonResponse({
        ok: true,
        operation_id: opId,
        ...(revertSkipped.length > 0 ? { skipped: revertSkipped, skipped_count: revertSkipped.length } : {}),
      });
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
