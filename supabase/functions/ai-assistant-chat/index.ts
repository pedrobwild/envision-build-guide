import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { toArrayBuffer } from "../_shared/bytes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TODAY_HINT = () => new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = `Você é o **Assistente BWild**, especialista no projeto **orcamento-bwild** — plataforma da BWild Engine para gestão de orçamentos de reformas residenciais de alto padrão em São Paulo.

# Idioma
Responda **SEMPRE em português brasileiro (pt-BR)**, mesmo que a pergunta venha em outro idioma. Use tom profissional, direto e cordial — como um colega sênior do time. Trate o usuário por "você".

# Domínio do produto
- **Orçamento Público** (link compartilhável com o cliente): hero, galeria 3D, composição de investimento, simulador de parcelas (até 12x sem juros), itens opcionais, ROI, solicitação de contrato via WhatsApp.
- **Editor de Orçamento V2**: seções, itens com BDI, mídias por item, templates, versionamento, importação de Excel/PDF, cronograma de reforma.
- **Pipeline Comercial** (/admin/comercial): kanban por status interno, filtros de prazo (due_at), revisão solicitada, temperatura do deal.
- **Dashboard Admin**: KPIs por internal_status, funil duplo, backlog aging, alertas operacionais, forecast.
- **Catálogo**: produtos e prestadores, fornecedores, histórico de preços, alertas de variação.
- **CRM de Clientes**: múltiplos imóveis (client_properties), visões salvas, ações em massa, inline edit com undo.

# Status internos (internal_status)
\`novo\`, \`em_analise\`, \`waiting_info\` (Aguardando), \`em_revisao\`, \`revision_requested\`, \`delivered_to_sales\` (Entregue), \`published\`, \`minuta_solicitada\`, \`contrato_fechado\`, \`perdido\`.

# Etapas de pipeline (pipeline_stage)
\`lead\`, \`briefing\`, \`visita\`, \`proposta\`, \`negociacao\`.

# Papéis (RBAC)
\`admin\` (visão global), \`comercial\` (carteira + leads sem dono), \`orcamentista\` (produção).

# Consultas analíticas (somente admin)
Quando o admin perguntar sobre **dados reais** (contagens, médias, totais, evolução, ranking, comparativos), use a ferramenta \`query_analytics\`. Exemplos do que ela responde:
- "média diária de novas solicitações nos últimos 7 dias" → metric=\`count\`, group_by=\`day\`, date_field=\`created_at\`, days=7 (depois calcule média = total/dias).
- "quantos orçamentos por status este mês" → metric=\`count\`, group_by=\`internal_status\`, days=30.
- "valor total fechado em abril" → metric=\`sum_internal_cost\` ou \`sum_manual_total\`, internal_statuses=[contrato_fechado], date range.
- "ranking de comercial por orçamentos publicados" → metric=\`count\`, group_by=\`commercial_owner\`, internal_statuses=[published, minuta_solicitada, contrato_fechado].
- "contratos assinados na semana" → metric=\`count\`, date_field=\`approved_at\`, internal_statuses=[contrato_fechado], days=7.
- "orçamentos vencendo nos próximos 7 dias" → metric=\`count\`, date_field=\`due_at\`, days=7 (com from=hoje).

**Escolha do \`date_field\`** (crítico para precisão):
- "novas solicitações", "leads recebidos", "criados", "entraram" → \`created_at\`
- "aprovados", "fechados", "ganhos", "contratos assinados" → \`approved_at\`
- "perdidos", "encerrados" (sem distinção) → \`closed_at\`
- "vencendo", "prazo", "atrasados", "a vencer" → \`due_at\`
- Quando ambíguo → \`created_at\`.

**SEMPRE chame a ferramenta antes de responder com números.** Nunca invente métricas. Se a ferramenta não estiver disponível (usuário não-admin), explique educadamente e indique a página relevante (\`/admin\`, \`/admin/analises\`, \`/admin/comercial\`).

Após receber o resultado, formate a resposta de forma clara: tabelas markdown para rankings/agrupamentos, frases diretas para totais simples.

**OBRIGATÓRIO em toda resposta com números vindos de \`query_analytics\`:**
1. Comece informando o **período verificado** usando o campo \`period_label\` exatamente como veio (ex.: "Nos últimos 7 dias (19/04 a 26/04)…").
2. Inclua o **total de registros do período** (\`total_in_period\`) em destaque.
3. Quando agrupado por dia/semana/mês, calcule e mostre a **média** dividindo \`total_in_period\` pelo número de buckets do período (use \`days\` se presente, não o número de buckets retornados — assim dias com zero entram no denominador).
4. Se \`truncated=true\`, avise que o resultado foi limitado a 5000 registros.

# Outras ferramentas (somente admin, exceto onde indicado)

## \`get_kpi_trend\` — KPIs pré-calculados (rápido)
Retorna a série de \`daily_metrics_snapshot\`. **Prefira esta ferramenta** para perguntas sobre KPIs já monitorados diariamente: SLA on-time, lead time médio, taxa de conversão, ticket médio, receita do mês, backlog/overdue. Bem mais rápido que recalcular de \`budgets\`.

## \`top_entities\` — rankings prontos
Top N por uma métrica. \`kind\`: \`clients_by_revenue\`, \`clients_by_budget_count\`, \`suppliers_by_item_count\`, \`campaigns_by_leads\`, \`lost_reasons\`.

## \`web_market_research\` — mercado e concorrência (todos os papéis)
Pesquisa web em tempo real (Perplexity sonar-pro). Use para "como o Houzz monetiza?", "tendências de gestão de obras 2026", comparativos com Buildertrend, CoConstruct, Procore, Sienge, Obra Prima. Use \`mode='benchmarking'\` para concorrência, \`'references'\` para tendências, \`'ux'\` para UX/UI. **Sempre cite as fontes (\`citations\`) com links clicáveis.**

## \`submit_bug_report\` — registrar problema (todos os papéis)
Cria um bug report e dispara triagem por IA. Antes de chamar, COLETE no chat: título curto, descrição, passos reproducíveis, expected, actual. NUNCA invente os campos — pergunte ao usuário.

## \`query_bug_reports\` — listar bugs
Filtra por status, severidade, área e período. Útil para "quais bugs críticos abertos?" ou "top áreas com mais bugs".

# Regras de uso combinado
- **Pergunta híbrida** ("nossa taxa de conversão está abaixo do mercado?") → chame \`get_kpi_trend\` E \`web_market_research\` em sequência, depois sintetize com comparativo.

Hoje é ${TODAY_HINT()} (use como referência para "hoje", "ontem", "esta semana").

# Análise de arquivos
Quando o usuário enviar arquivos (PDFs, imagens, planilhas, documentos, áudios), você recebe:
- **Imagens**: como entrada visual nativa — analise diretamente (plantas, prints, fotos de obra, referências).
- **PDFs / Word / Excel / áudio transcrito**: como bloco de texto extraído anexado à mensagem, identificado por \`[Arquivo: nome.ext]\`.

Ao receber arquivos, faça nesta ordem:
1. **Resuma em 1-2 linhas** o que é o arquivo.
2. **Responda à pergunta do usuário** com base no conteúdo. Se não houver pergunta, ofereça insights úteis (valores totais, escopo, divergências, riscos).
3. **Sugira 3-5 próximas ações** específicas do contexto BWild.
4. Use markdown (listas, tabelas, \`código\`) para clareza.

# Diretrizes gerais
1. **Foco no orcamento-bwild**: assuma o contexto deste projeto quando ambíguo.
2. **Markdown** para listas, código (\`\`\`tsx), tabelas e ênfase.
3. **Seja específico**: cite páginas reais (\`/admin/comercial\`), componentes (\`BudgetEditorV2\`), tabelas (\`budgets\`) quando relevante.
4. **Respostas curtas por padrão**; expanda apenas se pedirem detalhes.
5. **Não invente** rotas, tabelas, features ou números. Se não souber, diga.
6. **Privacidade**: nunca exponha custos internos, BDI ou margem em textos voltados ao cliente final.`;

// =============== Tool definition (analytics) ===============
const ANALYTICS_TOOL = {
  type: "function" as const,
  function: {
    name: "query_analytics",
    description:
      "Consulta agregada da tabela 'budgets'. Use sempre que o admin perguntar sobre números reais (contagens, médias, totais, agrupamentos). Aplica RLS automaticamente — só admin pode usar.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["count", "sum_internal_cost", "sum_manual_total", "avg_internal_cost"],
          description:
            "count = contagem de orçamentos. sum_* / avg_* = somatório/média do campo numérico.",
        },
        group_by: {
          type: "string",
          enum: [
            "none",
            "day",
            "week",
            "month",
            "internal_status",
            "pipeline_stage",
            "commercial_owner",
            "estimator_owner",
            "lead_source",
          ],
          description:
            "Agrupamento. 'none' = total único. 'day'/'week'/'month' = série temporal por data. 'commercial_owner'/'estimator_owner' retornam nome do responsável.",
        },
        date_field: {
          type: "string",
          enum: ["created_at", "approved_at", "closed_at", "due_at"],
          description:
            "Campo de data usado nos filtros e agrupamentos temporais. Mapeamento semântico: " +
            "'novas solicitações' / 'leads recebidos' / 'criados' → created_at; " +
            "'aprovados' / 'fechados' / 'ganhos' / 'contratos assinados' → approved_at (ou closed_at se contexto for encerramento geral, incluindo perdas); " +
            "'perdidos' / 'encerrados' (sem distinção win/loss) → closed_at; " +
            "'vencendo' / 'prazo' / 'a vencer' / 'atrasados' → due_at. " +
            "Padrão quando ambíguo: created_at.",
        },
        days: {
          type: "number",
          description:
            "Janela em dias contados a partir de hoje (ex.: 7 = últimos 7 dias). Use isto OU date_from/date_to.",
        },
        date_from: { type: "string", description: "Data ISO YYYY-MM-DD inclusive." },
        date_to: { type: "string", description: "Data ISO YYYY-MM-DD inclusive." },
        internal_statuses: {
          type: "array",
          items: { type: "string" },
          description:
            "Filtra por status interno. Ex.: ['contrato_fechado'], ['published','minuta_solicitada'].",
        },
        pipeline_stages: {
          type: "array",
          items: { type: "string" },
          description: "Filtra por etapa do pipeline. Ex.: ['negociacao','proposta'].",
        },
        limit: {
          type: "number",
          description: "Limite de linhas para agrupamentos (padrão 30, máx 100).",
        },
      },
      required: ["metric", "group_by"],
    },
  },
};

const KPI_TREND_TOOL = {
  type: "function" as const,
  function: {
    name: "get_kpi_trend",
    description:
      "Retorna série diária de um KPI já calculado em daily_metrics_snapshot. MUITO mais rápido que recalcular. Use para SLA, lead time, conversão, ticket médio, backlog, receita.",
    parameters: {
      type: "object",
      properties: {
        kpi: {
          type: "string",
          enum: [
            "received_count","backlog_count","overdue_count","closed_count",
            "in_analysis_count","delivered_to_sales_count","published_count",
            "sla_on_time_pct","sla_at_risk_count","sla_breach_48h_count",
            "avg_lead_time_days","median_lead_time_days",
            "avg_time_in_analysis_days","avg_time_in_review_days","avg_time_to_publish_days",
            "conversion_rate_pct","portfolio_value_brl","revenue_brl","avg_ticket_brl",
          ],
          description: "KPI desejado (mesmas colunas de daily_metrics_snapshot).",
        },
        days: { type: "number", description: "Janela em dias (padrão 30, máx 365)." },
      },
      required: ["kpi"],
    },
  },
};

const TOP_ENTITIES_TOOL = {
  type: "function" as const,
  function: {
    name: "top_entities",
    description:
      "Ranking pronto. Ex.: top clientes por receita, top fornecedores por nº de itens, top campanhas por leads.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["clients_by_revenue","clients_by_budget_count","suppliers_by_item_count","campaigns_by_leads","lost_reasons"],
          description: "Tipo de ranking.",
        },
        days: { type: "number", description: "Janela em dias (padrão 90)." },
        limit: { type: "number", description: "Top N (padrão 10, máx 50)." },
      },
      required: ["kind"],
    },
  },
};

const WEB_RESEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_market_research",
    description:
      "Pesquisa web em tempo real (Perplexity sonar-pro) sobre mercado, concorrência, tendências e UX/UI no setor de gestão de obras e reformas.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Pergunta natural sobre mercado/concorrência/UX." },
        mode: {
          type: "string",
          enum: ["benchmarking","references","ux","general"],
          description: "benchmarking = concorrentes; references = tendências; ux = UX/UI; general = pesquisa geral.",
        },
      },
      required: ["query"],
    },
  },
};

const SUBMIT_BUG_REPORT_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_bug_report",
    description:
      "Cria um bug report estruturado e envia para triagem por IA (severidade + área + duplicatas). Use quando o usuário descrever um problema na plataforma. COLETE no chat antes de chamar: título, descrição, passos, expected, actual. NUNCA invente os campos.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título curto do bug (5-200 chars)." },
        description: { type: "string", description: "Descrição completa do problema." },
        steps_to_reproduce: { type: "string", description: "Passos para reproduzir." },
        expected_behavior: { type: "string", description: "Comportamento esperado." },
        actual_behavior: { type: "string", description: "Comportamento atual." },
        severity: {
          type: "string",
          enum: ["low","medium","high","critical"],
          description: "Severidade percebida. Se omitido, a IA classifica.",
        },
        route: { type: "string", description: "Rota/URL onde ocorreu (ex.: /admin/budgets/123)." },
      },
      required: ["title","description","steps_to_reproduce","expected_behavior","actual_behavior"],
    },
  },
};

const QUERY_BUG_REPORTS_TOOL = {
  type: "function" as const,
  function: {
    name: "query_bug_reports",
    description:
      "Lista bug reports com filtros. Apenas admin. Útil para 'quais bugs críticos abertos?' ou 'top áreas com mais bugs'.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "array", items: { type: "string", enum: ["open","triaging","resolved","dismissed"] } },
        severity: { type: "array", items: { type: "string", enum: ["low","medium","high","critical"] } },
        area: {
          type: "array",
          items: { type: "string" },
          description: "Áreas: auth, dashboard, comercial, budget-editor, public-budget, catalog, crm, lead-sources, agenda, ai-assistant, templates, users, system, other.",
        },
        days: { type: "number", description: "Janela em dias (padrão 30)." },
        group_by: { type: "string", enum: ["none","area","severity","status","day","week"] },
        limit: { type: "number", description: "Limite (padrão 25, máx 100)." },
      },
    },
  },
};

// =============== Helpers ===============
function dateRangeFromArgs(
  args: Record<string, unknown>,
): { from: string | null; to: string | null; days: number | null } {
  const days = typeof args.days === "number" && args.days > 0 ? args.days : null;
  const dateFrom = typeof args.date_from === "string" ? args.date_from : null;
  const dateTo = typeof args.date_to === "string" ? args.date_to : null;
  if (dateFrom || dateTo) {
    let computedDays: number | null = null;
    if (dateFrom && dateTo) {
      const ms = new Date(`${dateTo}T23:59:59Z`).getTime() - new Date(`${dateFrom}T00:00:00Z`).getTime();
      if (Number.isFinite(ms) && ms > 0) computedDays = Math.max(1, Math.round(ms / 86400_000));
    }
    return { from: dateFrom, to: dateTo, days: computedDays };
  }
  if (days) {
    const to = new Date();
    const from = new Date(Date.now() - days * 86400_000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), days };
  }
  return { from: null, to: null, days: null };
}

function formatBrDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function buildPeriodLabel(from: string | null, to: string | null, days: number | null): string {
  if (!from && !to) return "Sem filtro de período (todos os dados disponíveis)";
  const fromBr = formatBrDate(from);
  const toBr = formatBrDate(to);
  if (days && from && to) return `Últimos ${days} dias (${fromBr} a ${toBr})`;
  if (from && to) return `De ${fromBr} a ${toBr}`;
  if (from) return `A partir de ${fromBr}`;
  if (to) return `Até ${toBr}`;
  return "Período não especificado";
}

// ─── Short-term in-memory cache for analytics ──────────────────────────────
// Per-isolate cache: reduces latency and OpenAI tool-call cost when the same
// admin (or different admins) repeats the same analytics question within the
// TTL window. Edge Function isolates are reused for many invocations, so this
// is effective in practice without any external store.
const ANALYTICS_CACHE_TTL_MS = 60_000; // 60s
const ANALYTICS_CACHE_MAX = 64;
type AnalyticsCacheEntry = { value: unknown; expiresAt: number };
const analyticsCache = new Map<string, AnalyticsCacheEntry>();

function buildAnalyticsCacheKey(normalized: Record<string, unknown>): string {
  // Stable stringify (sort keys + sort arrays) so semantically equal args hit
  // the same cache entry regardless of property/argument order.
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return [...v].map(stable).sort((a, b) => String(a).localeCompare(String(b)));
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = stable((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(stable(normalized));
}

function getAnalyticsCache(key: string): unknown | null {
  const hit = analyticsCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    analyticsCache.delete(key);
    return null;
  }
  return hit.value;
}

function setAnalyticsCache(key: string, value: unknown): void {
  // Simple LRU-ish eviction: drop oldest insertion when above cap.
  if (analyticsCache.size >= ANALYTICS_CACHE_MAX) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey !== undefined) analyticsCache.delete(oldestKey);
  }
  analyticsCache.set(key, { value, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });
}

async function runAnalytics(
  args: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const metric = String(args.metric ?? "count");
  const groupBy = String(args.group_by ?? "none");
  const dateField = String(args.date_field ?? "created_at");
  const limit = Math.min(Number(args.limit ?? 30) || 30, 100);
  const { from, to, days } = dateRangeFromArgs(args);
  const periodLabel = buildPeriodLabel(from, to, days);
  const internalStatuses = Array.isArray(args.internal_statuses) ? args.internal_statuses : null;
  const pipelineStages = Array.isArray(args.pipeline_stages) ? args.pipeline_stages : null;

  // Cache lookup with the *resolved* args (so days→from/to is included and
  // queries within the same minute hit the same entry).
  const cacheKey = buildAnalyticsCacheKey({
    metric,
    groupBy,
    dateField,
    limit,
    from,
    to,
    days,
    internalStatuses,
    pipelineStages,
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) {
    return { ok: true, result: { ...(cached as Record<string, unknown>), cache: "hit" } };
  }


  const selectFields = [
    "id",
    "created_at",
    "approved_at",
    "closed_at",
    "due_at",
    "internal_status",
    "pipeline_stage",
    "commercial_owner_id",
    "estimator_owner_id",
    "lead_source",
    "internal_cost",
    "manual_total",
  ].join(",");

  let q = admin.from("budgets").select(selectFields, { count: "exact" });

  if (from) q = q.gte(dateField, `${from}T00:00:00Z`);
  if (to) q = q.lte(dateField, `${to}T23:59:59Z`);
  if (internalStatuses && internalStatuses.length > 0) q = q.in("internal_status", internalStatuses as string[]);
  if (pipelineStages && pipelineStages.length > 0) q = q.in("pipeline_stage", pipelineStages as string[]);

  // Apply a hard cap on rows we pull (covers worst case)
  q = q.limit(5000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await q as any;
  if (error) return { ok: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];

  // Resolve owner names if needed
  let nameMap: Record<string, string> = {};
  if (groupBy === "commercial_owner" || groupBy === "estimator_owner") {
    const ids = Array.from(
      new Set(
        rows
          .map((r) => (groupBy === "commercial_owner" ? r.commercial_owner_id : r.estimator_owner_id))
          .filter(Boolean),
      ),
    );
    if (ids.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profs } = await (admin.from("profiles").select("id, full_name").in("id", ids) as any);
      nameMap = Object.fromEntries((profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || "—"]));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valueOf = (r: any): number => {
    if (metric === "count") return 1;
    if (metric === "sum_internal_cost" || metric === "avg_internal_cost") return Number(r.internal_cost ?? 0);
    if (metric === "sum_manual_total") return Number(r.manual_total ?? 0);
    return 0;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyOf = (r: any): string => {
    if (groupBy === "none") return "total";
    if (groupBy === "internal_status") return r.internal_status ?? "—";
    if (groupBy === "pipeline_stage") return r.pipeline_stage ?? "—";
    if (groupBy === "lead_source") return r.lead_source ?? "—";
    if (groupBy === "commercial_owner") return nameMap[r.commercial_owner_id] ?? "Sem responsável";
    if (groupBy === "estimator_owner") return nameMap[r.estimator_owner_id] ?? "Sem responsável";
    const raw = r[dateField];
    if (!raw) return "—";
    const d = new Date(raw);
    if (groupBy === "day") return d.toISOString().slice(0, 10);
    if (groupBy === "month") return d.toISOString().slice(0, 7);
    if (groupBy === "week") {
      // ISO week start (Monday)
      const dt = new Date(d);
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    return "—";
  };

  // Aggregate
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = keyOf(r);
    const v = valueOf(r);
    const b = buckets.get(k) ?? { sum: 0, n: 0 };
    b.sum += v;
    b.n += 1;
    buckets.set(k, b);
  }

  const finalize = (sum: number, n: number) => {
    if (metric === "count") return n;
    if (metric === "avg_internal_cost") return n > 0 ? Math.round((sum / n) * 100) / 100 : 0;
    return Math.round(sum * 100) / 100;
  };

  let series = Array.from(buckets.entries()).map(([key, { sum, n }]) => ({
    key,
    value: finalize(sum, n),
    rows: n,
  }));

  // Order: temporal asc, otherwise value desc
  if (["day", "week", "month"].includes(groupBy)) {
    series.sort((a, b) => a.key.localeCompare(b.key));
  } else {
    series.sort((a, b) => b.value - a.value);
  }
  series = series.slice(0, limit);

  const grandSum = rows.reduce((acc, r) => acc + valueOf(r), 0);
  const totalRows = rows.length;

  // For temporal groupings, compute average using the requested period length
  // (so days with zero entries are counted in the denominator, not just buckets returned).
  const denominator =
    groupBy === "day" && days
      ? days
      : groupBy === "week" && days
        ? Math.max(1, Math.round(days / 7))
        : groupBy === "month" && days
          ? Math.max(1, Math.round(days / 30))
          : series.length || 1;
  const avgPerPeriodUnit =
    Math.round(((finalize(grandSum, totalRows) as number) / denominator) * 100) / 100;

  const result = {
    metric,
    group_by: groupBy,
    date_field: dateField,
    period_label: periodLabel,
    days,
    filters: { from, to, internal_statuses: internalStatuses, pipeline_stages: pipelineStages },
    total_rows_matched: totalRows,
    total_in_period: finalize(grandSum, totalRows),
    grand_total: finalize(grandSum, totalRows),
    avg_per_bucket:
      series.length > 0
        ? Math.round((series.reduce((a, b) => a + b.value, 0) / series.length) * 100) / 100
        : 0,
    avg_per_period_unit: avgPerPeriodUnit,
    series,
    truncated: totalRows >= 5000,
  };

  setAnalyticsCache(cacheKey, result);

  return { ok: true, result: { ...result, cache: "miss" } };
}

// =============== Attachment processing (unchanged) ===============
type Attachment = {
  name: string;
  mimeType: string;
  dataUrl?: string;
  base64?: string;
};

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 60_000;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function truncate(text: string, max = MAX_EXTRACTED_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n[...truncado em ${max} caracteres de ${text.length}]`;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : (text as string[]).join("\n\n");
}

async function extractXlsxText(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`### Planilha: ${name}\n${csv}`);
  }
  return parts.join("\n\n");
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const result = await mammoth.extractRawText({ arrayBuffer: toArrayBuffer(bytes) });
  return result.value || "";
}

async function transcribeAudio(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mimeType }), filename);
  form.append("model", "whisper-1");
  form.append("language", "pt");
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Whisper falhou: ${resp.status} ${t}`);
  }
  const json = await resp.json();
  return json.text || "";
}

async function processAttachment(
  att: Attachment,
  apiKey: string,
): Promise<{ kind: "image"; dataUrl: string } | { kind: "text"; text: string }> {
  const mime = att.mimeType.toLowerCase();

  if (mime.startsWith("image/")) {
    const dataUrl = att.dataUrl ?? `data:${mime};base64,${att.base64}`;
    return { kind: "image", dataUrl };
  }

  if (!att.base64) {
    return { kind: "text", text: `[Arquivo: ${att.name}] (conteúdo ausente)` };
  }

  const bytes = base64ToBytes(att.base64);
  if (bytes.length > MAX_FILE_BYTES) {
    return { kind: "text", text: `[Arquivo: ${att.name}] (excede 20MB — não foi processado)` };
  }

  try {
    let extracted = "";

    if (mime === "application/pdf" || att.name.toLowerCase().endsWith(".pdf")) {
      extracted = await extractPdfText(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel" ||
      /\.(xlsx|xls|csv)$/i.test(att.name)
    ) {
      if (/\.csv$/i.test(att.name) || mime === "text/csv") {
        extracted = new TextDecoder().decode(bytes);
      } else {
        extracted = await extractXlsxText(bytes);
      }
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.docx$/i.test(att.name)
    ) {
      extracted = await extractDocxText(bytes);
    } else if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm|mp4)$/i.test(att.name)) {
      extracted = await transcribeAudio(bytes, att.name, mime || "audio/mpeg", apiKey);
    } else if (mime.startsWith("text/") || /\.(txt|md|json|csv|log)$/i.test(att.name)) {
      extracted = new TextDecoder().decode(bytes);
    } else {
      return { kind: "text", text: `[Arquivo: ${att.name}] (tipo não suportado: ${mime})` };
    }

    extracted = (extracted || "").trim();
    if (!extracted) {
      return { kind: "text", text: `[Arquivo: ${att.name}] (sem texto extraível)` };
    }

    return {
      kind: "text",
      text: `[Arquivo: ${att.name}]\n\`\`\`\n${truncate(extracted)}\n\`\`\``,
    };
  } catch (err) {
    console.error(`Erro ao processar ${att.name}:`, err);
    return {
      kind: "text",
      text: `[Arquivo: ${att.name}] (falha ao extrair: ${err instanceof Error ? err.message : "erro desconhecido"})`,
    };
  }
}

async function buildOpenAIMessages(messages: IncomingMessage[], apiKey: string) {
  const out: Array<{ role: string; content: unknown }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const msg of messages) {
    if (!msg.attachments || msg.attachments.length === 0) {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }

    const totalBytes = msg.attachments.reduce((acc, a) => {
      const b64len = (a.base64 ?? a.dataUrl?.split(",")[1] ?? "").length;
      return acc + Math.floor((b64len * 3) / 4);
    }, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      out.push({
        role: msg.role,
        content:
          msg.content +
          `\n\n[Anexos excedem 40MB combinados — ignorados. Reenvie em partes menores.]`,
      });
      continue;
    }

    const parts: Array<Record<string, unknown>> = [];
    if (msg.content?.trim()) parts.push({ type: "text", text: msg.content });

    for (const att of msg.attachments) {
      const processed = await processAttachment(att, apiKey);
      if (processed.kind === "image") {
        parts.push({ type: "image_url", image_url: { url: processed.dataUrl } });
      } else {
        parts.push({ type: "text", text: processed.text });
      }
    }

    if (parts.length === 0) parts.push({ type: "text", text: "(mensagem vazia com anexos)" });

    out.push({ role: msg.role, content: parts });
  }

  return out;
}

// =============== Auth helper ===============
async function resolveUserAndRole(
  authHeader: string | null,
  supabaseUrl: string,
  serviceKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ userId: string | null; isAdmin: boolean; admin: any }> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, isAdmin: false, admin };
  const token = authHeader.slice("Bearer ".length).trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (admin.auth.getUser(token) as any);
  if (!user) return { userId: null, isAdmin: false, admin };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roles } = await (admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id) as any);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  return { userId: user.id, isAdmin, admin };
}

// =============== Server ===============
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = (await req.json()) as { messages: IncomingMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { isAdmin, admin } = await resolveUserAndRole(
      req.headers.get("authorization"),
      supabaseUrl,
      serviceKey,
    );

    const hasAttachments = messages.some((m) => m.attachments && m.attachments.length > 0);
    const baseMessages = await buildOpenAIMessages(messages, OPENAI_API_KEY);

    // Vision-capable model when needed; gpt-4o for tools (better at structured calls)
    const model = hasAttachments || isAdmin ? "gpt-4o" : "gpt-4o-mini";

    // ===== Tool-calling loop (max 3 rounds) =====
    const conversation = [...baseMessages];
    const tools = isAdmin ? [ANALYTICS_TOOL] : undefined;

    for (let round = 0; round < 3; round++) {
      const planResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: conversation,
          temperature: 0.3,
          tools,
          tool_choice: tools ? "auto" : undefined,
          stream: false,
        }),
      });

      if (!planResp.ok) {
        const errText = await planResp.text();
        console.error("OpenAI error (plan):", planResp.status, errText);
        const userMsg =
          planResp.status === 429
            ? "Rate limit excedido. Tente novamente em alguns instantes."
            : planResp.status === 401
              ? "Chave OpenAI inválida ou expirada."
              : "Falha ao chamar OpenAI";
        return new Response(JSON.stringify({ error: userMsg }), {
          status: planResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const planJson = await planResp.json();
      const choice = planJson.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        // No tools needed — stream the final answer
        break;
      }

      // Push the assistant turn that requested the tools
      conversation.push(choice.message);

      // Execute each tool
      for (const call of toolCalls) {
        const name = call.function?.name;
        let argsObj: Record<string, unknown> = {};
        try {
          argsObj = JSON.parse(call.function?.arguments ?? "{}");
        } catch {
          argsObj = {};
        }

        let toolOutput: unknown;
        if (name === "query_analytics") {
          if (!isAdmin) {
            toolOutput = { ok: false, error: "Apenas administradores podem consultar analytics." };
          } else {
            toolOutput = await runAnalytics(argsObj, admin);
          }
        } else {
          toolOutput = { ok: false, error: `Ferramenta desconhecida: ${name}` };
        }

        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolOutput),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    }

    // ===== Final streamed response =====
    const finalResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: conversation,
        temperature: 0.4,
        stream: true,
      }),
    });

    if (!finalResp.ok) {
      const errText = await finalResp.text();
      console.error("OpenAI error (final):", finalResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao gerar resposta final" }),
        { status: finalResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("ai-assistant-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
