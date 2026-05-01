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

## \`compare_periods\` — comparativo período-a-período
Compara uma métrica entre o período atual e o período anterior do mesmo tamanho. Retorna \`current.total\`, \`previous.total\`, \`delta_absolute\`, \`delta_pct\` e \`direction\` (up/down/flat). **Use sempre que aparecer "comparado com", "vs", "em relação a", "crescemos", "melhoramos", "estamos melhor que", "evolução semanal/mensal".** Mais barato e direto que duas chamadas separadas a \`query_analytics\`.

## \`analyze_funnel\` — taxas de conversão entre estágios
Conta orçamentos por estágio e calcula conversão "do topo" e "vs etapa anterior" + drop-off. Use para "qual a conversão de lead para contrato?", "onde estamos perdendo mais?", "etapa com mais drop-off?". Aceita \`funnel_type\`: \`internal_status\` (operacional, padrão) ou \`pipeline_stage\` (comercial).

## \`forecast_metric\` — projeção via regressão linear
Projeta um KPI de \`daily_metrics_snapshot\` para os próximos N dias. Retorna histórico, série projetada, slope/dia, r² e \`caveat\` baseado na qualidade do ajuste. Use para "quanto vamos faturar nas próximas 2 semanas?", "qual o ritmo de crescimento do backlog?", "projeção de leads para o mês". **Sempre comunique o r² ao usuário** — projeção com r²<0.3 é frágil. Para horizontes >30 dias, alerte sobre incerteza acumulada.

## \`get_kpi_trend\` — KPIs pré-calculados (rápido)
Retorna a série de \`daily_metrics_snapshot\`. **Prefira esta ferramenta** para perguntas sobre KPIs já monitorados diariamente: SLA on-time, lead time médio, taxa de conversão, ticket médio, receita do mês, backlog/overdue. Bem mais rápido que recalcular de \`budgets\`.

## \`top_entities\` — rankings prontos
Top N por uma métrica. \`kind\`: \`clients_by_revenue\`, \`clients_by_budget_count\`, \`clients_by_avg_ticket\`, \`suppliers_by_item_count\`, \`campaigns_by_leads\`, \`lost_reasons\`, \`lost_reasons_by_value\` (motivos de perda ordenados por receita perdida em R$), \`estimators_by_velocity\` (orçamentistas mais rápidos a publicar), \`commercial_by_conversion\` (comerciais por taxa de fechamento).

## \`web_market_research\` — mercado e concorrência (todos os papéis)
Pesquisa web em tempo real (Perplexity sonar-pro). Use para "como o Houzz monetiza?", "tendências de gestão de obras 2026", comparativos com Buildertrend, CoConstruct, Procore, Sienge, Obra Prima. Use \`mode='benchmarking'\` para concorrência, \`'references'\` para tendências, \`'ux'\` para UX/UI. **Sempre cite as fontes (\`citations\`) com links clicáveis.**

## \`submit_bug_report\` — registrar problema (todos os papéis)
Cria um bug report e dispara triagem por IA. Antes de chamar, COLETE no chat: título curto, descrição, passos reproducíveis, expected, actual. NUNCA invente os campos — pergunte ao usuário.

## \`query_bug_reports\` — listar bugs
Filtra por status, severidade, área e período. Útil para "quais bugs críticos abertos?" ou "top áreas com mais bugs".

# Regras de uso combinado
- **Pergunta híbrida** ("nossa taxa de conversão está abaixo do mercado?") → chame \`get_kpi_trend\` E \`web_market_research\` em sequência, depois sintetize com comparativo.
- **Diagnóstico de queda/alta** ("por que caiu a receita?") → \`compare_periods\` para confirmar a queda, depois \`analyze_funnel\` para localizar a etapa do drop-off, e finalmente \`top_entities\` (\`commercial_by_conversion\` ou \`lost_reasons_by_value\`) para identificar a causa.
- **Planejamento futuro** ("vou bater a meta?") → \`forecast_metric\` para projeção, comparada com a meta declarada pelo usuário. Se r²<0.3, recomende monitorar e reavaliar antes de decisões.
- **Análise multidimensional** — quando precisar de números reais e tendência: \`query_analytics\` (com group_by="weekday" para padrões de dia da semana, ou "quarter" para sazonalidade) e depois interprete.

# Heurísticas analíticas
- Sempre que reportar um total, ofereça contexto: "vs período anterior?" → use \`compare_periods\`.
- Para perguntas sobre **distribuição** (ticket médio, valor mediano), prefira \`median_manual_total\` em vez de \`avg_manual_total\` — mais robusto a outliers.
- Para **clientes únicos**, use \`count_distinct_clients\` em vez de \`count\`.
- Quando o usuário fizer pergunta vaga ("como estamos?"), responda com 3 KPIs: volume (received_count), conversão (conversion_rate_pct), receita (revenue_brl), comparando com período anterior.

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
          enum: [
            "count",
            "count_distinct_clients",
            "sum_internal_cost",
            "sum_manual_total",
            "avg_internal_cost",
            "avg_manual_total",
            "median_manual_total",
            "p90_manual_total",
            "min_manual_total",
            "max_manual_total",
          ],
          description:
            "count = contagem de orçamentos. count_distinct_clients = clientes únicos. sum_* / avg_* / median_* / p90_* / min_* / max_* = estatísticas do campo numérico.",
        },
        group_by: {
          type: "string",
          enum: [
            "none",
            "day",
            "week",
            "month",
            "quarter",
            "year",
            "weekday",
            "internal_status",
            "pipeline_stage",
            "commercial_owner",
            "estimator_owner",
            "lead_source",
          ],
          description:
            "Agrupamento. 'none' = total único. 'day'/'week'/'month'/'quarter'/'year' = série temporal. 'weekday' = dia da semana (descobre padrões: segundas vs sextas). 'commercial_owner'/'estimator_owner' retornam nome do responsável.",
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
          enum: [
            "clients_by_revenue",
            "clients_by_budget_count",
            "clients_by_avg_ticket",
            "suppliers_by_item_count",
            "campaigns_by_leads",
            "lost_reasons",
            "lost_reasons_by_value",
            "estimators_by_velocity",
            "commercial_by_conversion",
          ],
          description:
            "Tipo de ranking. clients_by_avg_ticket = clientes ordenados por ticket médio. lost_reasons_by_value = motivos de perda ordenados por receita perdida (não nº de casos). estimators_by_velocity = orçamentistas ordenados por menor tempo médio de publicação. commercial_by_conversion = comerciais ordenados por taxa de conversão (fechados / atribuídos).",
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

const COMPARE_PERIODS_TOOL = {
  type: "function" as const,
  function: {
    name: "compare_periods",
    description:
      "Compara uma métrica entre dois períodos consecutivos do mesmo tamanho (período atual vs período anterior) e retorna delta absoluto, delta % e direção (up/down/flat). Use sempre que o admin perguntar 'crescemos?', 'estamos melhor?', 'comparado com a semana/mês passado', 'evolução vs período anterior'. Aceita os mesmos filtros do query_analytics.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: [
            "count",
            "count_distinct_clients",
            "sum_internal_cost",
            "sum_manual_total",
            "avg_internal_cost",
            "avg_manual_total",
            "median_manual_total",
          ],
        },
        date_field: {
          type: "string",
          enum: ["created_at", "approved_at", "closed_at", "due_at"],
          description: "Mesma semântica do query_analytics. Padrão: created_at.",
        },
        days: {
          type: "number",
          description:
            "Tamanho da janela em dias para CADA período. Ex.: 7 = compara últimos 7 dias com os 7 dias anteriores.",
        },
        internal_statuses: { type: "array", items: { type: "string" } },
        pipeline_stages: { type: "array", items: { type: "string" } },
      },
      required: ["metric", "days"],
    },
  },
};

const ANALYZE_FUNNEL_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_funnel",
    description:
      "Analisa o funil de orçamentos: quantos chegaram a cada estágio e a taxa de conversão entre estágios. Use para 'qual é a taxa de conversão de lead para contrato?', 'onde estamos perdendo mais?', 'qual etapa do pipeline tem mais drop-off?'. Conta orçamentos únicos por estágio máximo atingido.",
    parameters: {
      type: "object",
      properties: {
        funnel_type: {
          type: "string",
          enum: ["internal_status", "pipeline_stage"],
          description:
            "internal_status = funil operacional (novo→em_analise→...→contrato_fechado). pipeline_stage = funil comercial (lead→briefing→visita→proposta→negociacao). Padrão: internal_status.",
        },
        date_field: {
          type: "string",
          enum: ["created_at", "approved_at"],
          description: "Campo de data para janela. Padrão: created_at.",
        },
        days: { type: "number", description: "Janela em dias (padrão 30, máx 365)." },
        commercial_owner_id: { type: "string", description: "Filtra pelo dono comercial (UUID)." },
      },
    },
  },
};

const FORECAST_METRIC_TOOL = {
  type: "function" as const,
  function: {
    name: "forecast_metric",
    description:
      "Projeta um KPI já registrado em daily_metrics_snapshot para os próximos N dias usando regressão linear simples. Retorna histórico, série projetada, slope (tendência diária), intercept e r² (qualidade do ajuste). Use para 'quanto vamos faturar nas próximas 2 semanas?', 'qual a projeção de leads para o próximo mês?', 'a que ritmo o backlog está crescendo?'.",
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
        },
        lookback_days: { type: "number", description: "Histórico considerado (padrão 30, mín 7, máx 180)." },
        forecast_days: { type: "number", description: "Quantos dias projetar à frente (padrão 7, máx 90)." },
      },
      required: ["kpi"],
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
    "client_id",
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

  const usesManualTotal = metric === "sum_manual_total" || metric === "avg_manual_total"
    || metric === "median_manual_total" || metric === "p90_manual_total"
    || metric === "min_manual_total" || metric === "max_manual_total";
  const usesInternalCost = metric === "sum_internal_cost" || metric === "avg_internal_cost";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valueOf = (r: any): number => {
    if (metric === "count" || metric === "count_distinct_clients") return 1;
    if (usesInternalCost) return Number(r.internal_cost ?? 0);
    if (usesManualTotal) return Number(r.manual_total ?? 0);
    return 0;
  };

  const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
    if (groupBy === "year") return String(d.getUTCFullYear());
    if (groupBy === "quarter") {
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `${d.getUTCFullYear()}-Q${q}`;
    }
    if (groupBy === "weekday") {
      const idx = d.getUTCDay();
      return `${idx}-${WEEKDAY_NAMES[idx]}`;
    }
    if (groupBy === "week") {
      // ISO week start (Monday)
      const dt = new Date(d);
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    return "—";
  };

  // Aggregate (track per-bucket distinct client_ids and value samples for percentiles/min/max)
  type Bucket = {
    sum: number;
    n: number;
    clients: Set<string>;
    samples: number[];
  };
  const buckets = new Map<string, Bucket>();
  const needsSamples = metric === "median_manual_total" || metric === "p90_manual_total"
    || metric === "min_manual_total" || metric === "max_manual_total";
  for (const r of rows) {
    const k = keyOf(r);
    const v = valueOf(r);
    const b = buckets.get(k) ?? { sum: 0, n: 0, clients: new Set<string>(), samples: [] };
    b.sum += v;
    b.n += 1;
    if (metric === "count_distinct_clients" && r.client_id) b.clients.add(r.client_id);
    if (needsSamples) b.samples.push(Number(r.manual_total ?? 0));
    buckets.set(k, b);
  }

  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
    return sorted[idx];
  };

  const finalize = (b: Bucket): number => {
    if (metric === "count") return b.n;
    if (metric === "count_distinct_clients") return b.clients.size;
    if (metric === "avg_internal_cost" || metric === "avg_manual_total")
      return b.n > 0 ? Math.round((b.sum / b.n) * 100) / 100 : 0;
    if (metric === "median_manual_total")
      return Math.round(percentile(b.samples, 0.5) * 100) / 100;
    if (metric === "p90_manual_total")
      return Math.round(percentile(b.samples, 0.9) * 100) / 100;
    if (metric === "min_manual_total")
      return b.samples.length ? Math.round(Math.min(...b.samples) * 100) / 100 : 0;
    if (metric === "max_manual_total")
      return b.samples.length ? Math.round(Math.max(...b.samples) * 100) / 100 : 0;
    return Math.round(b.sum * 100) / 100;
  };

  let series = Array.from(buckets.entries()).map(([key, b]) => ({
    key,
    value: finalize(b),
    rows: b.n,
  }));

  // Order: temporal asc, otherwise value desc
  if (["day", "week", "month", "quarter", "year"].includes(groupBy)) {
    series.sort((a, b) => a.key.localeCompare(b.key));
  } else if (groupBy === "weekday") {
    // Sort by weekday index encoded as prefix "0-Domingo".."6-Sábado"
    series.sort((a, b) => a.key.localeCompare(b.key));
    series = series.map((s) => ({ ...s, key: s.key.split("-").slice(1).join("-") || s.key }));
  } else {
    series.sort((a, b) => b.value - a.value);
  }
  series = series.slice(0, limit);

  // Build a synthetic "grand bucket" so finalize() handles all metrics consistently.
  const grandBucket: Bucket = {
    sum: rows.reduce((acc, r) => acc + valueOf(r), 0),
    n: rows.length,
    clients: new Set<string>(rows.map((r) => r.client_id).filter(Boolean) as string[]),
    samples: needsSamples ? rows.map((r) => Number(r.manual_total ?? 0)) : [],
  };
  const grandTotal = finalize(grandBucket);
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
    Math.round((grandTotal / denominator) * 100) / 100;

  const result = {
    metric,
    group_by: groupBy,
    date_field: dateField,
    period_label: periodLabel,
    days,
    filters: { from, to, internal_statuses: internalStatuses, pipeline_stages: pipelineStages },
    total_rows_matched: totalRows,
    total_in_period: grandTotal,
    grand_total: grandTotal,
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

// =============== Tool: compare_periods ===============
async function runComparePeriods(
  args: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const days = Math.max(1, Math.min(Number(args.days ?? 7) || 7, 365));
  const metric = String(args.metric ?? "count");
  const dateField = String(args.date_field ?? "created_at");
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const currentTo = fmt(today);
  const currentFrom = fmt(new Date(today.getTime() - days * 86400_000));
  const previousTo = fmt(new Date(today.getTime() - days * 86400_000 - 1));
  const previousFrom = fmt(new Date(today.getTime() - 2 * days * 86400_000));

  const baseArgs: Record<string, unknown> = {
    metric,
    group_by: "none",
    date_field: dateField,
    internal_statuses: args.internal_statuses,
    pipeline_stages: args.pipeline_stages,
  };

  const [currRes, prevRes] = await Promise.all([
    runAnalytics({ ...baseArgs, date_from: currentFrom, date_to: currentTo }, admin),
    runAnalytics({ ...baseArgs, date_from: previousFrom, date_to: previousTo }, admin),
  ]);

  if (!currRes.ok) return { ok: false, error: currRes.error ?? "Falha no período atual" };
  if (!prevRes.ok) return { ok: false, error: prevRes.error ?? "Falha no período anterior" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentTotal = Number((currRes.result as any)?.total_in_period ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const previousTotal = Number((prevRes.result as any)?.total_in_period ?? 0);
  const deltaAbs = Math.round((currentTotal - previousTotal) * 100) / 100;
  const deltaPct = previousTotal !== 0
    ? Math.round(((currentTotal - previousTotal) / Math.abs(previousTotal)) * 10000) / 100
    : null;
  const direction = deltaAbs > 0 ? "up" : deltaAbs < 0 ? "down" : "flat";

  return {
    ok: true,
    result: {
      metric,
      date_field: dateField,
      window_days: days,
      current: {
        period_label: `Atual: ${formatBrDate(currentFrom)} a ${formatBrDate(currentTo)}`,
        from: currentFrom, to: currentTo, total: currentTotal,
      },
      previous: {
        period_label: `Anterior: ${formatBrDate(previousFrom)} a ${formatBrDate(previousTo)}`,
        from: previousFrom, to: previousTo, total: previousTotal,
      },
      delta_absolute: deltaAbs,
      delta_pct: deltaPct,
      direction,
    },
  };
}

// =============== Tool: analyze_funnel ===============
async function runAnalyzeFunnel(
  args: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const funnelType = String(args.funnel_type ?? "internal_status");
  const dateField = String(args.date_field ?? "created_at");
  const days = Math.max(1, Math.min(Number(args.days ?? 30) || 30, 365));
  const fromIso = new Date(Date.now() - days * 86400_000).toISOString();
  const ownerId = typeof args.commercial_owner_id === "string" ? args.commercial_owner_id : null;

  // Canonical stage ordering
  const STATUS_ORDER = [
    "novo", "em_analise", "waiting_info", "em_revisao", "revision_requested",
    "delivered_to_sales", "published", "minuta_solicitada", "contrato_fechado",
  ];
  const PIPELINE_ORDER = ["lead", "briefing", "visita", "proposta", "negociacao"];
  const order = funnelType === "pipeline_stage" ? PIPELINE_ORDER : STATUS_ORDER;
  const column = funnelType === "pipeline_stage" ? "pipeline_stage" : "internal_status";

  let q = admin
    .from("budgets")
    .select(`id, ${column}, manual_total, internal_cost, lost_at, created_at, approved_at`)
    .gte(dateField, fromIso)
    .limit(5000);
  if (ownerId) q = q.eq("commercial_owner_id", ownerId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await q) as any;
  if (error) return { ok: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const total = rows.length;

  // Bucket by current stage
  const counts = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const key = r[column] ?? "—";
    const acc = counts.get(key) ?? { count: 0, value: 0 };
    acc.count += 1;
    acc.value += Number(r.manual_total ?? r.internal_cost ?? 0);
    counts.set(key, acc);
  }

  // For internal_status funnel: cumulative-from-current is "reached at least this stage"
  // (assumes monotonic progression — which the system enforces in practice).
  const stages = order.map((stage, idx) => {
    const reached = order.slice(idx).reduce((acc, st) => {
      const c = counts.get(st);
      return c ? acc + c.count : acc;
    }, 0);
    const here = counts.get(stage)?.count ?? 0;
    const value = counts.get(stage)?.value ?? 0;
    return { stage, current_at_stage: here, reached_or_passed: reached, value_brl: Math.round(value * 100) / 100 };
  });

  // Lost / dropped (only meaningful for internal_status)
  const lostCount = funnelType === "internal_status" ? counts.get("perdido")?.count ?? 0 : 0;

  // Conversion rates: relative to first stage (received) and step-to-step
  const received = stages[0]?.reached_or_passed ?? 0;
  const enriched = stages.map((s, i) => {
    const prev = i > 0 ? stages[i - 1].reached_or_passed : received;
    const conversion_from_top_pct = received > 0
      ? Math.round((s.reached_or_passed / received) * 10000) / 100
      : 0;
    const conversion_from_prev_pct = prev > 0
      ? Math.round((s.reached_or_passed / prev) * 10000) / 100
      : 0;
    const drop_off_pct = prev > 0
      ? Math.round(((prev - s.reached_or_passed) / prev) * 10000) / 100
      : 0;
    return { ...s, conversion_from_top_pct, conversion_from_prev_pct, drop_off_pct };
  });

  return {
    ok: true,
    result: {
      funnel_type: funnelType,
      period_label: `Últimos ${days} dias`,
      date_field: dateField,
      total_budgets_in_window: total,
      lost_count: lostCount,
      stages: enriched,
      truncated: total >= 5000,
    },
  };
}

// =============== Tool: forecast_metric ===============
async function runForecastMetric(
  args: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const kpi = String(args.kpi ?? "");
  if (!kpi) return { ok: false, error: "kpi é obrigatório" };
  const lookback = Math.max(7, Math.min(Number(args.lookback_days ?? 30) || 30, 180));
  const horizon = Math.max(1, Math.min(Number(args.forecast_days ?? 7) || 7, 90));
  const fromIso = new Date(Date.now() - lookback * 86400_000).toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await admin
    .from("daily_metrics_snapshot")
    .select(`snapshot_date, ${kpi}`)
    .gte("snapshot_date", fromIso)
    .order("snapshot_date", { ascending: true })) as any;
  if (error) return { ok: false, error: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  if (rows.length < 3) {
    return {
      ok: false,
      error: `Dados insuficientes para projeção (${rows.length} pontos). Mínimo: 3 dias com snapshot.`,
    };
  }

  // Linear regression: y = a + b*x where x is days since first point
  const baseDate = new Date(rows[0].snapshot_date + "T00:00:00Z").getTime();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of rows) {
    const t = new Date(r.snapshot_date + "T00:00:00Z").getTime();
    const x = (t - baseDate) / 86400_000;
    const y = Number(r[kpi] ?? 0);
    if (Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  // r²
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i];
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - yhat) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;

  const lastX = xs[xs.length - 1];
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const history = rows.map((r) => ({ date: r.snapshot_date, value: Number(r[kpi] ?? 0) }));
  const projection: { date: string; value: number }[] = [];
  for (let i = 1; i <= horizon; i++) {
    const x = lastX + i;
    const t = new Date(baseDate + x * 86400_000).toISOString().slice(0, 10);
    projection.push({ date: t, value: round2(intercept + slope * x) });
  }
  const projectedTotal = round2(projection.reduce((a, b) => a + b.value, 0));
  const lastValue = ys[ys.length - 1];
  const projectedEnd = projection[projection.length - 1]?.value ?? lastValue;

  return {
    ok: true,
    result: {
      kpi,
      lookback_days: lookback,
      forecast_days: horizon,
      points_used: n,
      slope_per_day: round2(slope),
      intercept: round2(intercept),
      r_squared: Math.round(r2 * 1000) / 1000,
      trend: slope > 0.01 ? "growing" : slope < -0.01 ? "declining" : "flat",
      last_observed: round2(lastValue),
      projected_end_value: projectedEnd,
      projected_period_total: projectedTotal,
      history,
      projection,
      caveat:
        r2 < 0.3
          ? "r² baixo: tendência linear não explica bem a variação. Use a projeção como referência grosseira."
          : r2 < 0.6
            ? "r² moderado: projeção razoável, mas sujeita a ruído."
            : "r² alto: tendência consistente.",
    },
  };
}

// =============== Tool: get_kpi_trend ===============
async function runKpiTrend(
  args: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const kpi = String(args.kpi ?? "");
  if (!kpi) return { ok: false, error: "kpi é obrigatório" };
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
      days, points: series.length,
      latest: last, first, delta_from_first: delta,
      avg: Math.round(avg * 100) / 100,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      series,
    },
  };
}

// =============== Tool: top_entities ===============
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

  if (
    kind === "clients_by_revenue" ||
    kind === "clients_by_budget_count" ||
    kind === "clients_by_avg_ticket"
  ) {
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
      .map(([id, v]) => ({
        id,
        name: nameMap[id] ?? "—",
        count: v.count,
        revenue: Math.round(v.revenue * 100) / 100,
        avg_ticket: v.count > 0 ? Math.round((v.revenue / v.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => {
        if (kind === "clients_by_revenue") return b.revenue - a.revenue;
        if (kind === "clients_by_avg_ticket") return b.avg_ticket - a.avg_ticket;
        return b.count - a.count;
      })
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

  if (kind === "lost_reasons" || kind === "lost_reasons_by_value") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("budget_lost_reasons")
      .select("reason_category, budget_id")
      .gte("lost_at", from)) as any;
    if (error) return { ok: false, error: error.message };
    type LostRow = { reason_category: string | null; budget_id: string | null };
    const lostRows = (data ?? []) as LostRow[];

    let valueByBudget = new Map<string, number>();
    if (kind === "lost_reasons_by_value") {
      const budgetIds = Array.from(new Set(lostRows.map((r) => r.budget_id).filter(Boolean) as string[]));
      if (budgetIds.length > 0) {
        // deno-lint-ignore no-explicit-any
        const { data: bdata } = (await admin
          .from("budgets")
          .select("id, manual_total, internal_cost")
          .in("id", budgetIds)) as any;
        valueByBudget = new Map(
          (bdata ?? []).map((b: { id: string; manual_total: number | null; internal_cost: number | null }) => [
            b.id,
            Number(b.manual_total ?? b.internal_cost ?? 0),
          ]),
        );
      }
    }

    const agg = new Map<string, { count: number; value: number }>();
    for (const r of lostRows) {
      const k = r.reason_category ?? "—";
      const acc = agg.get(k) ?? { count: 0, value: 0 };
      acc.count += 1;
      if (kind === "lost_reasons_by_value" && r.budget_id) {
        acc.value += valueByBudget.get(r.budget_id) ?? 0;
      }
      agg.set(k, acc);
    }
    const top = Array.from(agg.entries())
      .map(([reason, v]) => ({
        reason,
        count: v.count,
        lost_value_brl: Math.round(v.value * 100) / 100,
      }))
      .sort((a, b) =>
        kind === "lost_reasons_by_value" ? b.lost_value_brl - a.lost_value_brl : b.count - a.count,
      )
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top } };
  }

  if (kind === "estimators_by_velocity") {
    // Average days from created_at → published_at (or first_publication_at) per estimator.
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("budgets")
      .select("estimator_owner_id, created_at, first_publication_at, internal_status")
      .gte("created_at", from)
      .in("internal_status", ["published", "minuta_solicitada", "contrato_fechado", "delivered_to_sales"])) as any;
    if (error) return { ok: false, error: error.message };
    type Row = {
      estimator_owner_id: string | null;
      created_at: string;
      first_publication_at: string | null;
    };
    const agg = new Map<string, { sumDays: number; n: number }>();
    for (const r of (data ?? []) as Row[]) {
      if (!r.estimator_owner_id || !r.first_publication_at) continue;
      const days = (new Date(r.first_publication_at).getTime() - new Date(r.created_at).getTime()) / 86400_000;
      if (!Number.isFinite(days) || days < 0) continue;
      const acc = agg.get(r.estimator_owner_id) ?? { sumDays: 0, n: 0 };
      acc.sumDays += days;
      acc.n += 1;
      agg.set(r.estimator_owner_id, acc);
    }
    const ids = Array.from(agg.keys()).slice(0, 200);
    // deno-lint-ignore no-explicit-any
    const { data: profs } = ids.length
      ? ((await admin.from("profiles").select("id, full_name").in("id", ids)) as any)
      : { data: [] };
    const nameMap = Object.fromEntries(
      (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || "—"]),
    );
    const top = Array.from(agg.entries())
      .map(([id, v]) => ({
        id,
        name: nameMap[id] ?? "—",
        budgets_published: v.n,
        avg_days_to_publish: Math.round((v.sumDays / v.n) * 100) / 100,
      }))
      .filter((r) => r.budgets_published >= 2) // exclude noise from one-off cases
      .sort((a, b) => a.avg_days_to_publish - b.avg_days_to_publish)
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top } };
  }

  if (kind === "commercial_by_conversion") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("budgets")
      .select("commercial_owner_id, internal_status, manual_total, created_at")
      .gte("created_at", from)) as any;
    if (error) return { ok: false, error: error.message };
    type Row = {
      commercial_owner_id: string | null;
      internal_status: string | null;
      manual_total: number | null;
    };
    const WON = new Set(["contrato_fechado", "minuta_solicitada"]);
    const CLOSED = new Set(["contrato_fechado", "minuta_solicitada", "perdido"]);
    const agg = new Map<string, { assigned: number; closed: number; won: number; revenue: number }>();
    for (const r of (data ?? []) as Row[]) {
      if (!r.commercial_owner_id) continue;
      const acc = agg.get(r.commercial_owner_id) ?? { assigned: 0, closed: 0, won: 0, revenue: 0 };
      acc.assigned += 1;
      if (r.internal_status && CLOSED.has(r.internal_status)) acc.closed += 1;
      if (r.internal_status && WON.has(r.internal_status)) {
        acc.won += 1;
        acc.revenue += Number(r.manual_total ?? 0);
      }
      agg.set(r.commercial_owner_id, acc);
    }
    const ids = Array.from(agg.keys()).slice(0, 200);
    // deno-lint-ignore no-explicit-any
    const { data: profs } = ids.length
      ? ((await admin.from("profiles").select("id, full_name").in("id", ids)) as any)
      : { data: [] };
    const nameMap = Object.fromEntries(
      (profs ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || "—"]),
    );
    const top = Array.from(agg.entries())
      .map(([id, v]) => ({
        id,
        name: nameMap[id] ?? "—",
        assigned: v.assigned,
        closed: v.closed,
        won: v.won,
        revenue_brl: Math.round(v.revenue * 100) / 100,
        conversion_pct:
          v.closed > 0 ? Math.round((v.won / v.closed) * 10000) / 100 : 0,
      }))
      .filter((r) => r.closed >= 2) // need at least 2 closed deals to compute meaningful conversion
      .sort((a, b) => b.conversion_pct - a.conversion_pct)
      .slice(0, limit);
    return { ok: true, result: { kind, period_label: periodLabel, days, top } };
  }

  if (kind === "suppliers_by_item_count") {
    // deno-lint-ignore no-explicit-any
    const { data, error } = (await admin
      .from("catalog_item_supplier_prices")
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

// =============== Tool: web_market_research (Perplexity) ===============
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
    systemPrompt = `Você é um analista de produto especializado em benchmarking de softwares de gestão de obras e reformas residenciais. Compare concorrentes como Houzz, Buildertrend, CoConstruct, Procore, Sienge, Obra Prima, Veja Obra. Identifique funcionalidades inovadoras, modelos de pricing, tendências e oportunidades de diferenciação. Responda em português brasileiro com sugestões concretas e acionáveis, organizando por categorias.`;
  } else if (mode === "references") {
    systemPrompt = `Você é um pesquisador especializado em tecnologia para construção civil e reformas residenciais. Pesquise funcionalidades, tendências e melhores práticas. Cite fontes sempre que possível.`;
  } else if (mode === "ux") {
    systemPrompt = `Você é especialista em UX/UI para aplicações de gestão de obras. Analise hierarquia de informação, copy, fluxos e sugestões de melhoria. Priorize as recomendações.`;
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
      query, mode,
      content: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
      generated_at: new Date().toISOString(),
    },
  };
}

// =============== Tool: submit_bug_report (delega para edge function) ===============
async function runSubmitBugReport(
  args: Record<string, unknown>,
  authHeader: string | null,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  if (!authHeader) return { ok: false, error: "Sessão expirada — faça login novamente." };

  const title = String(args.title ?? "").trim();
  const description = String(args.description ?? "").trim();
  const steps = String(args.steps_to_reproduce ?? "").trim();
  const expected = String(args.expected_behavior ?? "").trim();
  const actual = String(args.actual_behavior ?? "").trim();
  if (!title || !description || !steps || !expected || !actual) {
    return { ok: false, error: "title, description, steps_to_reproduce, expected_behavior e actual_behavior são obrigatórios." };
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/bug-report-triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({
        mode: "create",
        title, description,
        steps_to_reproduce: steps,
        expected_behavior: expected,
        actual_behavior: actual,
        severity: args.severity,
        route: args.route,
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data?.error ?? `bug-report-triage ${resp.status}` };
    const bug = data.bug_report ?? data;
    return {
      ok: true,
      result: {
        bug_id: bug?.id,
        severity: bug?.severity_ai ?? bug?.severity,
        area: bug?.area_ai,
        triage_summary: bug?.triage_summary,
        duplicate_of: data.duplicate_of ?? bug?.duplicate_of,
        message: (data.duplicate_of ?? bug?.duplicate_of)
          ? "Bug registrado e marcado como possível duplicata de um bug existente."
          : "Bug registrado e triado pela IA.",
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar bug report." };
  }
}

// =============== Tool: query_bug_reports ===============
async function runQueryBugReports(
  args: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const days = Math.min(Math.max(Number(args.days ?? 30) || 30, 1), 365);
  const limit = Math.min(Math.max(Number(args.limit ?? 25) || 25, 1), 100);
  const groupBy = String(args.group_by ?? "none");
  const fromIso = new Date(Date.now() - days * 86400_000).toISOString();

  let q = admin
    .from("bug_reports")
    .select("id, title, severity, severity_ai, area_ai, status, user_role, created_at, route, triage_tags, triage_summary")
    .gte("created_at", fromIso)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (Array.isArray(args.status) && args.status.length) q = q.in("status", args.status as string[]);
  if (Array.isArray(args.severity) && args.severity.length) q = q.in("severity_ai", args.severity as string[]);
  if (Array.isArray(args.area) && args.area.length) q = q.in("area_ai", args.area as string[]);

  // deno-lint-ignore no-explicit-any
  const { data, error } = (await q) as any;
  if (error) return { ok: false, error: error.message };
  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];

  if (groupBy === "none") {
    return {
      ok: true,
      result: {
        period_label: `Últimos ${days} dias`,
        total: rows.length,
        items: rows.slice(0, limit),
      },
    };
  }

  // deno-lint-ignore no-explicit-any
  const keyOf = (r: any): string => {
    if (groupBy === "area") return r.area_ai ?? "(não triado)";
    if (groupBy === "severity") return r.severity_ai ?? "(não triado)";
    if (groupBy === "status") return r.status ?? "—";
    const d = new Date(r.created_at);
    if (groupBy === "day") return d.toISOString().slice(0, 10);
    if (groupBy === "week") {
      const dt = new Date(d);
      const day = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - day);
      return dt.toISOString().slice(0, 10);
    }
    return "—";
  };

  const buckets = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  const series = Array.from(buckets.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) =>
      ["day", "week"].includes(groupBy) ? a.key.localeCompare(b.key) : b.count - a.count,
    )
    .slice(0, limit);

  return {
    ok: true,
    result: {
      period_label: `Últimos ${days} dias`,
      group_by: groupBy,
      total: rows.length,
      series,
    },
  };
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
      if (!apiKey) {
        return { kind: "text", text: `[Arquivo: ${att.name}] (transcrição de áudio indisponível — OPENAI_API_KEY não configurada)` };
      }
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY"); // optional, only for Whisper audio
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
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
    // Use OPENAI_API_KEY for Whisper if available; otherwise audio attachments are skipped.
    const baseMessages = await buildOpenAIMessages(messages, OPENAI_API_KEY ?? "");

    // ===== Configuração de cadeia de modelos e retry (via env vars) =====
    // AI_MODEL_CHAIN: lista de modelos separados por vírgula (primeiro = preferido).
    // AI_RETRYABLE_STATUSES: lista de status HTTP separados por vírgula que devem
    //   acionar fallback para o próximo modelo (sem precisar redeployar).
    // 429 e 402 são EXCLUÍDOS do default — são limites de workspace, não de modelo.
    const DEFAULT_MODEL_CHAIN = [
      "google/gemini-2.5-flash",
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash-lite",
      "openai/gpt-5-mini",
    ];
    const DEFAULT_RETRYABLE_STATUSES = [408, 425, 500, 502, 503, 504];

    const parseList = (raw: string | undefined): string[] =>
      (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const modelChain = (() => {
      const list = parseList(Deno.env.get("AI_MODEL_CHAIN"));
      return list.length > 0 ? list : DEFAULT_MODEL_CHAIN;
    })();

    const retryableStatuses = (() => {
      const list = parseList(Deno.env.get("AI_RETRYABLE_STATUSES"))
        .map((n) => Number.parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      return list.length > 0 ? list : DEFAULT_RETRYABLE_STATUSES;
    })();

    const isRetryableStatus = (status: number): boolean => {
      // Nunca retry para limites de workspace
      if (status === 429 || status === 402) return false;
      return retryableStatuses.includes(status);
    };

    /**
     * Chama o gateway tentando cada modelo da cadeia em sequência.
     * Faz fallback apenas para status retryable (configurável) ou erros de rede.
     */
    const callGatewayWithFallback = async (
      body: Record<string, unknown>,
    ): Promise<{ resp: Response; modelUsed: string }> => {
      let lastResp: Response | null = null;
      let lastErr: unknown = null;

      for (let i = 0; i < modelChain.length; i++) {
        const candidate = modelChain[i];
        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...body, model: candidate }),
          });

          if (resp.ok) {
            if (i > 0) {
              console.log(`[ai-fallback] modelo "${candidate}" funcionou após fallback (índice ${i})`);
            }
            return { resp, modelUsed: candidate };
          }

          // Não retryable: devolve direto
          if (!isRetryableStatus(resp.status)) {
            return { resp, modelUsed: candidate };
          }

          // Retryable: registra e tenta o próximo
          const errText = await resp.text().catch(() => "");
          console.warn(
            `[ai-fallback] modelo "${candidate}" falhou (status ${resp.status}); tentando próximo. Detalhes: ${errText.slice(0, 200)}`,
          );
          lastResp = new Response(errText, {
            status: resp.status,
            headers: resp.headers,
          });
        } catch (err) {
          lastErr = err;
          console.warn(
            `[ai-fallback] erro de rede no modelo "${candidate}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (lastResp) return { resp: lastResp, modelUsed: modelChain[modelChain.length - 1] };
      throw lastErr ?? new Error("Falha ao chamar o gateway em todos os modelos");
    };

    // ===== Tool-calling loop (max 4 rounds) =====
    const conversation = [...baseMessages];
    const tools = isAdmin
      ? [
          ANALYTICS_TOOL,
          COMPARE_PERIODS_TOOL,
          ANALYZE_FUNNEL_TOOL,
          FORECAST_METRIC_TOOL,
          KPI_TREND_TOOL,
          TOP_ENTITIES_TOOL,
          WEB_RESEARCH_TOOL,
          SUBMIT_BUG_REPORT_TOOL,
          QUERY_BUG_REPORTS_TOOL,
        ]
      : [WEB_RESEARCH_TOOL, SUBMIT_BUG_REPORT_TOOL];

    for (let round = 0; round < 4; round++) {
      const { resp: planResp } = await callGatewayWithFallback({
        messages: conversation,
        tools,
        tool_choice: tools.length ? "auto" : undefined,
        stream: false,
      });

      if (!planResp.ok) {
        const errText = await planResp.text();
        console.error("Lovable AI error (plan):", planResp.status, errText);
        const userMsg =
          planResp.status === 429
            ? "Rate limit excedido. Tente novamente em alguns instantes."
            : planResp.status === 402
              ? "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage."
              : "Falha ao chamar Lovable AI";
        return new Response(JSON.stringify({ error: userMsg }), {
          status: planResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const planJson = await planResp.json();
      const choice = planJson.choices?.[0];
      const toolCalls = choice?.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        break;
      }

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
        } else if (name === "compare_periods") {
          toolOutput = isAdmin
            ? await runComparePeriods(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem comparar períodos." };
        } else if (name === "analyze_funnel") {
          toolOutput = isAdmin
            ? await runAnalyzeFunnel(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem analisar funil." };
        } else if (name === "forecast_metric") {
          toolOutput = isAdmin
            ? await runForecastMetric(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem projetar métricas." };
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
        } else if (name === "submit_bug_report") {
          toolOutput = await runSubmitBugReport(argsObj, req.headers.get("authorization"));
        } else if (name === "query_bug_reports") {
          toolOutput = isAdmin
            ? await runQueryBugReports(argsObj, admin)
            : { ok: false, error: "Apenas administradores podem consultar bug reports." };
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
    const { resp: finalResp } = await callGatewayWithFallback({
      messages: conversation,
      stream: true,
    });

    if (!finalResp.ok) {
      const errText = await finalResp.text();
      console.error("Lovable AI error (final):", finalResp.status, errText);
      const userMsg =
        finalResp.status === 429
          ? "Rate limit excedido. Tente novamente em alguns instantes."
          : finalResp.status === 402
            ? "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage."
            : "Falha ao gerar resposta final";
      return new Response(
        JSON.stringify({ error: userMsg }),
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
