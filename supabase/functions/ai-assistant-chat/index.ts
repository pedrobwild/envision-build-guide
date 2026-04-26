// supabase/functions/ai-assistant-chat/index.ts
//
// Assistente BWild — chat com tool-calling.
//
// Capacidades:
//  - query_analytics      → agregações multi-tabela (budgets, clients, lead_sources, items, suppliers, daily_metrics_snapshot)
//  - get_kpi_trend        → série temporal de KPIs já calculados em daily_metrics_snapshot
//  - top_entities         → ranking pronto (top clientes por receita, top fornecedores, top categorias, etc.)
//  - web_market_research  → pesquisa de mercado/concorrência via Perplexity (sonar-pro)
//
// Mantém compatibilidade total com o cliente (UI AiAssistant.tsx) — mesma rota,
// mesmo formato de stream SSE da OpenAI.
//
// SEGURANÇA
//  - Todas as tools que tocam o banco usam o cliente service-role mas
//    revalidam o papel do usuário (admin) antes de executar.
//  - Usuários não-admin recebem o conjunto de tools vazio.
//  - Limite de 5000 linhas por consulta agregada e LRU cache de 60s.
//
// ──────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { toArrayBuffer } from "../_shared/bytes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TODAY_HINT = () => new Date().toISOString().slice(0, 10);

// ─── System prompt ────────────────────────────────────────────────────────

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

# ⚙️ Ferramentas disponíveis (somente admin)

Você tem acesso a 4 ferramentas. **Use sempre que a pergunta envolver dados reais ou mercado** — nunca invente números.

## 1. \`query_analytics\` — agregações em tempo real
Consulta multi-tabela com agregação. Use para perguntas como:
- "média de orçamentos por dia nos últimos 7 dias" → table=\`budgets\`, metric=\`count\`, group_by=\`day\`, days=7
- "ticket médio em abril" → table=\`budgets\`, metric=\`avg_internal_cost\`, days=30
- "ranking de comerciais por publicações" → table=\`budgets\`, metric=\`count\`, group_by=\`commercial_owner\`, internal_statuses=[published, minuta_solicitada, contrato_fechado]
- "leads recebidos por origem nos últimos 30 dias" → table=\`lead_sources\`, metric=\`count\`, group_by=\`source\`, days=30
- "novos clientes no mês" → table=\`clients\`, metric=\`count\`, days=30
- "fornecedores ativos por categoria" → table=\`suppliers\`, metric=\`count\`, days=null

**Escolha do \`date_field\` em \`budgets\`** (crítico para precisão):
- "novas solicitações" / "criados" / "entraram" → \`created_at\`
- "aprovados" / "fechados" / "ganhos" / "contratos assinados" → \`approved_at\`
- "perdidos" / "encerrados" → \`closed_at\`
- "vencendo" / "prazo" / "a vencer" / "atrasados" → \`due_at\`

## 2. \`get_kpi_trend\` — KPIs pré-calculados (rápido)
Retorna a série de \`daily_metrics_snapshot\`. **Prefira esta ferramenta** para perguntas sobre KPIs que já são monitorados diariamente:
SLA on-time, lead time médio, taxa de conversão, ticket médio, receita do mês, backlog/overdue. Bem mais rápido que recalcular de \`budgets\`.

Exemplos: "como está nossa taxa de conversão na última semana?", "evolução do SLA on-time nos últimos 30 dias", "ticket médio histórico".

## 3. \`top_entities\` — rankings prontos
Top N entidades por uma métrica. Exemplos: top clientes por receita, top fornecedores por número de itens, top campanhas por leads.

## 4. \`web_market_research\` — mercado e concorrência
Pesquisa web em tempo real (Perplexity sonar-pro). Use para:
- "como o Houzz monetiza?", "tendências de gestão de obras 2026", "como concorrentes mostram orçamento ao cliente"
- comparativos com Buildertrend, CoConstruct, Procore, Sienge, Obra Prima
- benchmarks de mercado, pricing, features

Use \`mode='benchmarking'\` para concorrência, \`mode='references'\` para tendências/melhores práticas, \`mode='ux'\` para UX/UI.

# Regras de uso

1. **Pergunta híbrida** ("nossa taxa de conversão está abaixo do mercado?") → chame \`get_kpi_trend\` E \`web_market_research\` em sequência, depois sintetize com comparativo.
2. **SEMPRE chame a ferramenta antes de responder com números.** Nunca invente.
3. **Após \`query_analytics\`**, OBRIGATORIAMENTE inclua na resposta:
   - O **período verificado** usando \`period_label\` exatamente como veio (ex.: "Nos últimos 7 dias (19/04 a 26/04)…").
   - O **total de registros do período** (\`total_in_period\`).
   - Para agrupamentos por dia/semana/mês, calcule a **média** dividindo \`total_in_period\` pelo \`days\` (não pelo número de buckets — assim dias com zero entram no denominador).
   - Se \`truncated=true\`, avise que foi limitado a 5000 registros.
4. **Após \`web_market_research\`**, sempre cite as fontes (campo \`citations\`) com links clicáveis.
5. **Tabelas markdown** para rankings/agrupamentos, frases diretas para totais simples.
6. Se a tool não estiver disponível (não-admin), explique educadamente e indique a página relevante (\`/admin\`, \`/admin/analises\`, \`/admin/comercial\`).

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

// ─── Tool definitions ─────────────────────────────────────────────────────

const ANALYTICS_TOOL = {
  type: "function" as const,
  function: {
    name: "query_analytics",
    description:
      "Agregação multi-tabela em tempo real. Suporta tabelas: budgets, clients, lead_sources, items, suppliers, catalog_items, catalog_price_history. Aplica RLS automaticamente — só admin.",
    parameters: {
      type: "object",
      properties: {
        table: {
          type: "string",
          enum: [
            "budgets",
            "clients",
            "lead_sources",
            "items",
            "suppliers",
            "catalog_items",
            "catalog_price_history",
          ],
          description:
            "Tabela alvo. budgets = orçamentos. clients = clientes. lead_sources = leads recebidos (Meta/Google/etc.). items = linhas de orçamento. suppliers = fornecedores. catalog_items = catálogo de produtos. catalog_price_history = histórico de preços.",
        },
        metric: {
          type: "string",
          enum: [
            "count",
            "sum_internal_cost",
            "sum_manual_total",
            "avg_internal_cost",
            "sum_internal_total",
            "avg_internal_total",
            "sum_qty",
          ],
          description:
            "count = contagem. sum_*/avg_* = soma/média do campo numérico equivalente da tabela escolhida.",
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
            "source",
            "status",
            "city",
            "bairro",
            "processing_status",
            "campaign_name",
            "form_name",
            "supplier_id",
            "category_id",
          ],
          description:
            "Agrupamento. 'none' = total. 'day/week/month' = série temporal. Demais = dimensão da própria tabela.",
        },
        date_field: {
          type: "string",
          enum: [
            "created_at",
            "approved_at",
            "closed_at",
            "due_at",
            "received_at",
            "processed_at",
            "updated_at",
          ],
          description:
            "Campo de data para filtros e séries. Para budgets: created_at|approved_at|closed_at|due_at. Para lead_sources: received_at|processed_at. Para clients/items/suppliers/catalog_*: created_at|updated_at.",
        },
        days: { type: "number", description: "Janela em dias a partir de hoje. Use ISTO ou date_from/date_to." },
        date_from: { type: "string", description: "Data ISO YYYY-MM-DD inclusive." },
        date_to: { type: "string", description: "Data ISO YYYY-MM-DD inclusive." },
        internal_statuses: {
          type: "array",
          items: { type: "string" },
          description: "Filtra budgets por internal_status. Ex.: ['contrato_fechado'].",
        },
        pipeline_stages: {
          type: "array",
          items: { type: "string" },
          description: "Filtra budgets por pipeline_stage. Ex.: ['negociacao'].",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Filtra lead_sources.source. Ex.: ['meta_ads','google_ads'].",
        },
        client_status: {
          type: "array",
          items: { type: "string" },
          description: "Filtra clients.status. Ex.: ['lead','active','won'].",
        },
        limit: { type: "number", description: "Limite de linhas no agrupamento (padrão 30, máx 100)." },
      },
      required: ["table", "metric", "group_by"],
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
            "received_count",
            "backlog_count",
            "overdue_count",
            "closed_count",
            "in_analysis_count",
            "delivered_to_sales_count",
            "published_count",
            "sla_on_time_pct",
            "sla_at_risk_count",
            "sla_breach_48h_count",
            "avg_lead_time_days",
            "median_lead_time_days",
            "avg_time_in_analysis_days",
            "avg_time_in_review_days",
            "avg_time_to_publish_days",
            "conversion_rate_pct",
            "portfolio_value_brl",
            "revenue_brl",
            "avg_ticket_brl",
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
          enum: [
            "clients_by_revenue",
            "clients_by_budget_count",
            "suppliers_by_item_count",
            "campaigns_by_leads",
            "lost_reasons",
          ],
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
      "Pesquisa web em tempo real (Perplexity sonar-pro) sobre mercado, concorrência, tendências e UX/UI no setor de gestão de obras e reformas. Use para perguntas sobre Houzz, Buildertrend, CoConstruct, Procore, Sienge, Obra Prima, etc., ou tendências de mercado.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Pergunta natural sobre mercado/concorrência/UX." },
        mode: {
          type: "string",
          enum: ["benchmarking", "references", "ux", "general"],
          description:
            "benchmarking = analisar concorrentes; references = tendências/melhores práticas; ux = UX/UI; general = pesquisa geral.",
        },
      },
      required: ["query"],
    },
  },
};

// ─── Helpers de período ───────────────────────────────────────────────────

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

// ─── Cache analítico (60s, LRU 64) ────────────────────────────────────────

const ANALYTICS_CACHE_TTL_MS = 60_000;
const ANALYTICS_CACHE_MAX = 64;
type AnalyticsCacheEntry = { value: unknown; expiresAt: number };
const analyticsCache = new Map<string, AnalyticsCacheEntry>();

function buildAnalyticsCacheKey(normalized: Record<string, unknown>): string {
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
  if (analyticsCache.size >= ANALYTICS_CACHE_MAX) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey !== undefined) analyticsCache.delete(oldestKey);
  }
  analyticsCache.set(key, { value, expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS });
}

// ─── Configuração de tabelas ──────────────────────────────────────────────

type TableConfig = {
  selectFields: string;
  defaultDateField: string;
  numericFieldByMetric: Record<string, string | null>;
};

const TABLE_CONFIG: Record<string, TableConfig> = {
  budgets: {
    selectFields:
      "id,created_at,approved_at,closed_at,due_at,updated_at,internal_status,pipeline_stage,commercial_owner_id,estimator_owner_id,lead_source,internal_cost,manual_total",
    defaultDateField: "created_at",
    numericFieldByMetric: {
      count: null,
      sum_internal_cost: "internal_cost",
      avg_internal_cost: "internal_cost",
      sum_manual_total: "manual_total",
    },
  },
  clients: {
    selectFields: "id,name,status,source,city,bairro,commercial_owner_id,is_active,created_at,updated_at",
    defaultDateField: "created_at",
    numericFieldByMetric: { count: null },
  },
  lead_sources: {
    selectFields:
      "id,source,form_name,campaign_name,adset_name,ad_name,client_id,budget_id,processing_status,received_at,processed_at,created_at",
    defaultDateField: "received_at",
    numericFieldByMetric: { count: null },
  },
  items: {
    selectFields:
      "id,section_id,title,qty,unit,internal_unit_price,internal_total,created_at",
    defaultDateField: "created_at",
    numericFieldByMetric: {
      count: null,
      sum_internal_total: "internal_total",
      avg_internal_total: "internal_total",
      sum_qty: "qty",
    },
  },
  suppliers: {
    selectFields: "id,name,is_active,created_at,updated_at",
    defaultDateField: "created_at",
    numericFieldByMetric: { count: null },
  },
  catalog_items: {
    selectFields: "id,name,category_id,is_active,created_at,updated_at",
    defaultDateField: "created_at",
    numericFieldByMetric: { count: null },
  },
  catalog_price_history: {
    selectFields: "id,supplier_id,catalog_item_id,unit_price,recorded_at,created_at",
    defaultDateField: "created_at",
    numericFieldByMetric: { count: null },
  },
};

// ─── Tool: query_analytics ────────────────────────────────────────────────

async function runAnalytics(
  args: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const table = String(args.table ?? "budgets");
  const cfg = TABLE_CONFIG[table];
  if (!cfg) return { ok: false, error: `Tabela não permitida: ${table}` };

  const metric = String(args.metric ?? "count");
  if (!(metric in cfg.numericFieldByMetric)) {
    return { ok: false, error: `Métrica '${metric}' não é válida para a tabela '${table}'.` };
  }

  const groupBy = String(args.group_by ?? "none");
  const dateField = String(args.date_field ?? cfg.defaultDateField);
  const limit = Math.min(Number(args.limit ?? 30) || 30, 100);
  const { from, to, days } = dateRangeFromArgs(args);
  const periodLabel = buildPeriodLabel(from, to, days);
  const internalStatuses = Array.isArray(args.internal_statuses) ? args.internal_statuses : null;
  const pipelineStages = Array.isArray(args.pipeline_stages) ? args.pipeline_stages : null;
  const sources = Array.isArray(args.sources) ? args.sources : null;
  const clientStatus = Array.isArray(args.client_status) ? args.client_status : null;

  const cacheKey = buildAnalyticsCacheKey({
    table, metric, groupBy, dateField, limit, from, to, days,
    internalStatuses, pipelineStages, sources, clientStatus,
  });
  const cached = getAnalyticsCache(cacheKey);
  if (cached) return { ok: true, result: { ...(cached as Record<string, unknown>), cache: "hit" } };

  let q = admin.from(table).select(cfg.selectFields, { count: "exact" });

  if (from) q = q.gte(dateField, `${from}T00:00:00Z`);
  if (to) q = q.lte(dateField, `${to}T23:59:59Z`);
  if (table === "budgets" && internalStatuses?.length) q = q.in("internal_status", internalStatuses as string[]);
  if (table === "budgets" && pipelineStages?.length) q = q.in("pipeline_stage", pipelineStages as string[]);
  if (table === "lead_sources" && sources?.length) q = q.in("source", sources as string[]);
  if (table === "clients" && clientStatus?.length) q = q.in("status", clientStatus as string[]);

  q = q.limit(5000);
  // deno-lint-ignore no-explicit-any
  const { data, error } = (await q) as any;
  if (error) return { ok: false, error: error.message };
  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];

  // Resolver nomes de owners se preciso
  let nameMap: Record<string, string> = {};
  if (table === "budgets" && (groupBy === "commercial_owner" || groupBy === "estimator_owner")) {
    const idKey = groupBy === "commercial_owner" ? "commercial_owner_id" : "estimator_owner_id";
    const ids = Array.from(new Set(rows.map((r) => r[idKey]).filter(Boolean)));
    if (ids.length) {
      // deno-lint-ignore no-explicit-any
      const { data: profs } = (await admin.from("profiles").select("id, full_name").in("id", ids)) as any;
      nameMap = Object.fromEntries(
        (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || "—"]),
      );
    }
  }

  const numericField = cfg.numericFieldByMetric[metric];
  // deno-lint-ignore no-explicit-any
  const valueOf = (r: any): number => {
    if (metric === "count") return 1;
    return Number((numericField && r[numericField]) ?? 0);
  };

  // deno-lint-ignore no-explicit-any
  const keyOf = (r: any): string => {
    if (groupBy === "none") return "total";
    if (groupBy === "internal_status") return r.internal_status ?? "—";
    if (groupBy === "pipeline_stage") return r.pipeline_stage ?? "—";
    if (groupBy === "lead_source") return r.lead_source ?? "—";
    if (groupBy === "source") return r.source ?? "—";
    if (groupBy === "status") return r.status ?? "—";
    if (groupBy === "city") return r.city ?? "—";
    if (groupBy === "bairro") return r.bairro ?? "—";
    if (groupBy === "processing_status") return r.processing_status ?? "—";
    if (groupBy === "campaign_name") return r.campaign_name ?? "—";
    if (groupBy === "form_name") return r.form_name ?? "—";
    if (groupBy === "supplier_id") return r.supplier_id ?? "—";
    if (groupBy === "category_id") return r.category_id ?? "—";
    if (groupBy === "commercial_owner") return nameMap[r.commercial_owner_id] ?? "Sem responsável";
    if (groupBy === "estimator_owner") return nameMap[r.estimator_owner_id] ?? "Sem responsável";
    const raw = r[dateField];
    if (!raw) return "—";
    const d = new Date(raw);
    if (groupBy === "day") return d.toISOString().slice(0, 10);
    if (groupBy === "month") return d.toISOString().slice(0, 7);
    if (groupBy === "week") {
      const dt = new Date(d);
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    return "—";
  };

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
    if (metric.startsWith("avg_")) return n > 0 ? Math.round((sum / n) * 100) / 100 : 0;
    return Math.round(sum * 100) / 100;
  };

  let series = Array.from(buckets.entries()).map(([key, { sum, n }]) => ({
    key, value: finalize(sum, n), rows: n,
  }));
  if (["day", "week", "month"].includes(groupBy)) series.sort((a, b) => a.key.localeCompare(b.key));
  else series.sort((a, b) => b.value - a.value);
  series = series.slice(0, limit);

  const grandSum = rows.reduce((acc, r) => acc + valueOf(r), 0);
  const totalRows = rows.length;
  const denominator =
    groupBy === "day" && days ? days
      : groupBy === "week" && days ? Math.max(1, Math.round(days / 7))
      : groupBy === "month" && days ? Math.max(1, Math.round(days / 30))
      : (series.length || 1);
  const avgPerPeriodUnit =
    Math.round((((finalize(grandSum, totalRows) as number) / denominator) || 0) * 100) / 100;

  const result = {
    table, metric, group_by: groupBy, date_field: dateField, period_label: periodLabel, days,
    filters: { from, to, internal_statuses: internalStatuses, pipeline_stages: pipelineStages, sources, client_status: clientStatus },
    total_rows_matched: totalRows,
    total_in_period: finalize(grandSum, totalRows),
    grand_total: finalize(grandSum, totalRows),
    avg_per_bucket: series.length > 0
      ? Math.round((series.reduce((a, b) => a + b.value, 0) / series.length) * 100) / 100
      : 0,
    avg_per_period_unit: avgPerPeriodUnit,
    series,
    truncated: totalRows >= 5000,
  };

  setAnalyticsCache(cacheKey, result);
  return { ok: true, result: { ...result, cache: "miss" } };
}

// ─── Tool: get_kpi_trend ──────────────────────────────────────────────────

async function runKpiTrend(
  args: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const kpi = String(args.kpi ?? "");
  const days = Math.min(Math.max(Number(args.days ?? 30) || 30, 1), 365);
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  // deno-lint-ignore no-explicit-any
  const { data, error } = (await admin
    .from("daily_metrics_snapshot")
    .select(`snapshot_date, ${kpi}`)
    .gte("snapshot_date", from)
    .order("snapshot_date", { ascending: true })) as any;
  if (error) return { ok: false, error: error.message };
  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];
  const series = rows.map((r) => ({ key: r.snapshot_date, value: Number(r[kpi] ?? 0) }));
  const values = series.map((s) => s.value).filter((v) => Number.isFinite(v));
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const last = series[series.length - 1]?.value ?? null;
  const first = series[0]?.value ?? null;
  const delta = last !== null && first !== null ? Math.round((last - first) * 100) / 100 : null;
  return {
    ok: true,
    result: {
      kpi,
      period_label: `Últimos ${days} dias (${formatBrDate(from)} a ${formatBrDate(TODAY_HINT())})`,
      days,
      points: series.length,
      latest: last,
      first,
      delta_from_first: delta,
      avg: Math.round(avg * 100) / 100,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      series,
    },
  };
}

// ─── Tool: top_entities ───────────────────────────────────────────────────

async function runTopEntities(
  args: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const kind = String(args.kind ?? "");
  const days = Math.min(Math.max(Number(args.days ?? 90) || 90, 1), 730);
  const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 50);
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const periodLabel = `Últimos ${days} dias`;

  if (kind === "clients_by_revenue" || kind === "clients_by_budget_count") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("budgets")
      .select("client_id, manual_total, internal_cost, internal_status, approved_at")
      .gte("approved_at", from)
      .in("internal_status", ["contrato_fechado", "minuta_solicitada"])) as any;
    if (error) return { ok: false, error: error.message };
    const agg = new Map<string, { count: number; revenue: number }>();
    for (const r of data ?? []) {
      if (!r.client_id) continue;
      const acc = agg.get(r.client_id) ?? { count: 0, revenue: 0 };
      acc.count += 1;
      acc.revenue += Number(r.manual_total ?? r.internal_cost ?? 0);
      agg.set(r.client_id, acc);
    }
    const ids = Array.from(agg.keys()).slice(0, 200);
    // deno-lint-ignore no-explicit-any
    const { data: clients } = ids.length
      ? ((await admin.from("clients").select("id, name").in("id", ids)) as any)
      : { data: [] };
    const nameMap = Object.fromEntries((clients ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
    const sorted = Array.from(agg.entries())
      .map(([id, v]) => ({ id, name: nameMap[id] ?? "—", count: v.count, revenue: Math.round(v.revenue * 100) / 100 }))
      .sort((a, b) => (kind === "clients_by_revenue" ? b.revenue - a.revenue : b.count - a.count))
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top: sorted } };
  }

  if (kind === "campaigns_by_leads") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("lead_sources")
      .select("campaign_name, source")
      .gte("received_at", from)) as any;
    if (error) return { ok: false, error: error.message };
    const agg = new Map<string, number>();
    for (const r of data ?? []) {
      const k = `${r.source ?? "—"} · ${r.campaign_name ?? "—"}`;
      agg.set(k, (agg.get(k) ?? 0) + 1);
    }
    const top = Array.from(agg.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top } };
  }

  if (kind === "lost_reasons") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("budget_lost_reasons")
      .select("reason")
      .gte("created_at", from)) as any;
    if (error) return { ok: false, error: error.message };
    const agg = new Map<string, number>();
    for (const r of data ?? []) agg.set(r.reason ?? "—", (agg.get(r.reason ?? "—") ?? 0) + 1);
    const top = Array.from(agg.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top } };
  }

  if (kind === "suppliers_by_item_count") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("catalog_item_suppliers")
      .select("supplier_id")) as any;
    if (error) return { ok: false, error: error.message };
    const agg = new Map<string, number>();
    for (const r of data ?? []) agg.set(r.supplier_id, (agg.get(r.supplier_id) ?? 0) + 1);
    const ids = Array.from(agg.keys()).slice(0, 200);
    // deno-lint-ignore no-explicit-any
    const { data: sups } = ids.length
      ? ((await admin.from("suppliers").select("id, name").in("id", ids)) as any)
      : { data: [] };
    const nameMap = Object.fromEntries((sups ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
    const top = Array.from(agg.entries())
      .map(([id, count]) => ({ id, name: nameMap[id] ?? "—", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: "Total acumulado", top } };
  }

  return { ok: false, error: `Tipo de ranking não suportado: ${kind}` };
}

// ─── Tool: web_market_research (Perplexity) ───────────────────────────────

async function runWebResearch(
  args: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const query = String(args.query ?? "").trim();
  if (!query) return { ok: false, error: "query é obrigatório" };
  const mode = String(args.mode ?? "general");
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return { ok: false, error: "PERPLEXITY_API_KEY não configurada" };

  let systemPrompt =
    "Você é um analista de mercado especializado em softwares de gestão de obras e reformas residenciais no Brasil. Responda em português brasileiro de forma objetiva, com bullets e dados concretos quando disponíveis.";
  if (mode === "benchmarking") {
    systemPrompt = `Você é um analista de produto especializado em benchmarking de softwares de gestão de obras e reformas residenciais.
Compare concorrentes como Houzz, Buildertrend, CoConstruct, Procore, Sienge, Obra Prima, Veja Obra.
Identifique funcionalidades inovadoras, modelos de pricing, tendências e oportunidades de diferenciação.
Responda em português brasileiro com sugestões concretas e acionáveis, organizando por categorias.`;
  } else if (mode === "references") {
    systemPrompt = `Você é um pesquisador especializado em tecnologia para construção civil e reformas residenciais.
Pesquise funcionalidades, tendências e melhores práticas. Cite fontes sempre que possível.`;
  } else if (mode === "ux") {
    systemPrompt = `Você é especialista em UX/UI para aplicações de gestão de obras.
Analise hierarquia de informação, copy, fluxos e sugestões de melhoria. Priorize as recomendações.`;
  }

  const resp = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      search_recency_filter: "month",
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    return { ok: false, error: `Perplexity ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const data = await resp.json();
  return {
    ok: true,
    result: {
      query,
      mode,
      content: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
      generated_at: new Date().toISOString(),
    },
  };
}

// ─── Anexos (mantido) ─────────────────────────────────────────────────────

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
  bytes: Uint8Array, filename: string, mimeType: string, apiKey: string,
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
  if (!resp.ok) throw new Error(`Whisper falhou: ${resp.status} ${await resp.text().catch(() => "")}`);
  const json = await resp.json();
  return json.text || "";
}
async function processAttachment(
  att: Attachment, apiKey: string,
): Promise<{ kind: "image"; dataUrl: string } | { kind: "text"; text: string }> {
  const mime = att.mimeType.toLowerCase();
  if (mime.startsWith("image/")) {
    const dataUrl = att.dataUrl ?? `data:${mime};base64,${att.base64}`;
    return { kind: "image", dataUrl };
  }
  if (!att.base64) return { kind: "text", text: `[Arquivo: ${att.name}] (conteúdo ausente)` };
  const bytes = base64ToBytes(att.base64);
  if (bytes.length > MAX_FILE_BYTES)
    return { kind: "text", text: `[Arquivo: ${att.name}] (excede 20MB — não foi processado)` };
  try {
    let extracted = "";
    if (mime === "application/pdf" || att.name.toLowerCase().endsWith(".pdf")) {
      extracted = await extractPdfText(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel" || /\.(xlsx|xls|csv)$/i.test(att.name)
    ) {
      if (/\.csv$/i.test(att.name) || mime === "text/csv") extracted = new TextDecoder().decode(bytes);
      else extracted = await extractXlsxText(bytes);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.docx$/i.test(att.name)
    ) extracted = await extractDocxText(bytes);
    else if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm|mp4)$/i.test(att.name))
      extracted = await transcribeAudio(bytes, att.name, mime || "audio/mpeg", apiKey);
    else if (mime.startsWith("text/") || /\.(txt|md|json|csv|log)$/i.test(att.name))
      extracted = new TextDecoder().decode(bytes);
    else return { kind: "text", text: `[Arquivo: ${att.name}] (tipo não suportado: ${mime})` };
    extracted = (extracted || "").trim();
    if (!extracted) return { kind: "text", text: `[Arquivo: ${att.name}] (sem texto extraível)` };
    return { kind: "text", text: `[Arquivo: ${att.name}]\n\`\`\`\n${truncate(extracted)}\n\`\`\`` };
  } catch (err) {
    console.error(`Erro ao processar ${att.name}:`, err);
    return {
      kind: "text",
      text: `[Arquivo: ${att.name}] (falha ao extrair: ${err instanceof Error ? err.message : "erro desconhecido"})`,
    };
  }
}
async function buildOpenAIMessages(messages: IncomingMessage[], apiKey: string) {
  const out: Array<{ role: string; content: unknown }> = [{ role: "system", content: SYSTEM_PROMPT }];
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
        content: msg.content + `\n\n[Anexos excedem 40MB combinados — ignorados. Reenvie em partes menores.]`,
      });
      continue;
    }
    const parts: Array<Record<string, unknown>> = [];
    if (msg.content?.trim()) parts.push({ type: "text", text: msg.content });
    for (const att of msg.attachments) {
      const processed = await processAttachment(att, apiKey);
      if (processed.kind === "image") parts.push({ type: "image_url", image_url: { url: processed.dataUrl } });
      else parts.push({ type: "text", text: processed.text });
    }
    if (parts.length === 0) parts.push({ type: "text", text: "(mensagem vazia com anexos)" });
    out.push({ role: msg.role, content: parts });
  }
  return out;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

async function resolveUserAndRole(
  authHeader: string | null, supabaseUrl: string, serviceKey: string,
  // deno-lint-ignore no-explicit-any
): Promise<{ userId: string | null; isAdmin: boolean; admin: any }> {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, isAdmin: false, admin };
  const token = authHeader.slice("Bearer ".length).trim();
  // deno-lint-ignore no-explicit-any
  const { data: { user } } = (await admin.auth.getUser(token)) as any;
  if (!user) return { userId: null, isAdmin: false, admin };
  // deno-lint-ignore no-explicit-any
  const { data: roles } = (await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)) as any;
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  return { userId: user.id, isAdmin, admin };
}

// ─── Server ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = (await req.json()) as { messages: IncomingMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { isAdmin, admin } = await resolveUserAndRole(req.headers.get("authorization"), supabaseUrl, serviceKey);
    const hasAttachments = messages.some((m) => m.attachments && m.attachments.length > 0);
    const baseMessages = await buildOpenAIMessages(messages, OPENAI_API_KEY);
    const model = hasAttachments || isAdmin ? "gpt-4o" : "gpt-4o-mini";
    const conversation = [...baseMessages];
    const tools = isAdmin
      ? [ANALYTICS_TOOL, KPI_TREND_TOOL, TOP_ENTITIES_TOOL, WEB_RESEARCH_TOOL]
      : [WEB_RESEARCH_TOOL];

    // tool-calling loop (até 4 rodadas para acomodar perguntas híbridas)
    for (let round = 0; round < 4; round++) {
      const planResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, messages: conversation, temperature: 0.3,
          tools, tool_choice: tools.length ? "auto" : undefined, stream: false,
        }),
      });
      if (!planResp.ok) {
        const errText = await planResp.text();
        console.error("OpenAI error (plan):", planResp.status, errText);
        const userMsg =
          planResp.status === 429 ? "Rate limit excedido. Tente novamente em alguns instantes."
          : planResp.status === 401 ? "Chave OpenAI inválida ou expirada."
          : "Falha ao chamar OpenAI";
        return new Response(JSON.stringify({ error: userMsg }), {
          status: planResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const planJson = await planResp.json();
      const choice = planJson.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      conversation.push(choice.message);

      for (const call of toolCalls) {
        const name = call.function?.name;
        let argsObj: Record<string, unknown> = {};
        try { argsObj = JSON.parse(call.function?.arguments ?? "{}"); } catch { argsObj = {}; }

        let toolOutput: unknown;
        if (name === "query_analytics") {
          toolOutput = isAdmin
            ? await runAnalytics(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem consultar analytics." };
        } else if (name === "get_kpi_trend") {
          toolOutput = isAdmin
            ? await runKpiTrend(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem consultar KPIs." };
        } else if (name === "top_entities") {
          toolOutput = isAdmin
            ? await runTopEntities(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem consultar rankings." };
        } else if (name === "web_market_research") {
          toolOutput = await runWebResearch(argsObj);
        } else {
          toolOutput = { ok: false, error: `Ferramenta desconhecida: ${name}` };
        }

        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolOutput),
          // deno-lint-ignore no-explicit-any
        } as any);
      }
    }

    // resposta final em stream
    const finalResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: conversation, temperature: 0.4, stream: true }),
    });
    if (!finalResp.ok) {
      const errText = await finalResp.text();
      console.error("OpenAI error (final):", finalResp.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao gerar resposta final" }), {
        status: finalResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(finalResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("ai-assistant-chat error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
