// Edge function: operations-insights
// Receives a rich snapshot of operational metrics and returns AI-generated
// insights (prioritized alerts, root-cause hypotheses, recommendations,
// estimated financial impact) tuned for executives.
//
// Uses Lovable AI Gateway with GPT-5 (reasoning) and structured tool calling.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FunnelStageSnap { label: string; count: number; passRate: number | null; drop: number }
interface AgingSnap { label: string; count: number }
interface StalledSnap { label: string; count: number; avgDays: number }
interface StageEffSnap { label: string; count: number; avgDaysInStage: number; efficiency: string }
interface MonthlyFinSnap { month: string; revenue: number; cost: number; profit: number; margin: number }
interface TeamSnap {
  name: string;
  activeBudgets: number;
  completedInPeriod: number;
  overdueCount: number;
  waitingInfoCount: number;
  avgLeadTimeDays: number | null;
  slaRate: number;
  health: string;
}
interface SlaRiskSnap { projectName: string; clientName: string; hoursLeft: number; status?: string }
interface SlaForecastSnap { predictedBreaches7d: number; riskBudgets: number; confidence: string }
interface BacklogStatusSnap { label: string; count: number }
interface LocalAlertSnap { id: string; severity: string; title: string; count: number | null }
interface LocalInsightSnap { type: string; message: string }
interface HealthFactorSnap { label: string; weight: number; contribution: number }

interface MetricsSnapshot {
  period: { from: string; to: string; days: number };
  kpis: {
    received: number;
    receivedPrev: number;
    receivedChangePct: number | null;
    backlog: number;
    backlogTrend: string | null;
    overdue: number;
    slaOnTime: number;
    avgLeadTime: number | null;
    avgLeadTimePrev: number | null;
    conversionRate: number | null;
    conversionRatePrev: number | null;
    grossMargin: number | null;
    grossMarginPrev: number | null;
    portfolioValue: number;
    closedCount: number;
    revenue: number;
    revenueChangePct: number | null;
    avgTicket: number | null;
    throughputPerWeek: number | null;
    throughputTrend: string | null;
    healthScore: number;
    healthFactors?: HealthFactorSnap[];
  };
  funnels: {
    operational: FunnelStageSnap[];
    commercial: FunnelStageSnap[];
  };
  aging: AgingSnap[];
  stalled: StalledSnap[];
  stageEfficiency?: StageEffSnap[];
  monthlyFinancials?: MonthlyFinSnap[];
  team: TeamSnap[];
  slaForecast?: SlaForecastSnap;
  slaRisk: SlaRiskSnap[];
  backlogByStatus?: BacklogStatusSnap[];
  localAlerts?: LocalAlertSnap[];
  localInsights?: LocalInsightSnap[];
}

const SYSTEM_PROMPT = `Você é um Diretor de Operações de uma empresa de orçamentos para reformas e construção. Combina visão estratégica com domínio operacional. Foco: traduzir números em decisões de gestão.

MISSÃO
Receba um snapshot completo de métricas (período atual, período anterior, funis, equipe, aging, alertas locais já calculados) e devolva 3-6 insights priorizados que um diretor leria em 90 segundos.

DIRETRIZES DE QUALIDADE (siga TODAS)
1. PRIORIZAÇÃO REAL — os 1-2 primeiros insights devem ser os de maior impacto financeiro ou risco de SLA. Nunca enche com banalidades.
2. CRUZAMENTO — combine pelo menos duas dimensões em cada insight (ex.: "backlog × responsável", "stalled stage × valor em carteira", "queda de conversão × throughput").
3. CAUSA-RAIZ ESPECÍFICA — uma frase explicando POR QUÊ está acontecendo, citando o sinal observado nos dados. Evite tautologia ("SLA caiu porque entregas atrasaram").
4. AÇÃO ACIONÁVEL — ação concreta, com verbo no imperativo, limitada ao escopo de 7 dias. "Redistribuir 3 orçamentos do João para a Maria" > "Revisar carga".
5. IMPACTO QUANTIFICADO — quando possível, calcule \`estimatedImpactBRL\` real usando \`portfolioValue\`, \`revenue\` ou \`avgTicket\`. Use 0 quando genuinamente não houver base.
6. PERÍODO-A-PERÍODO — cite explicitamente variações ("conversão caiu de 32% para 18%", "throughput dobrou vs período anterior"). Use os campos *Prev e *ChangePct fornecidos.
7. NÃO REPITA OS ALERTAS LOCAIS — eles já estão no app. Se um alerta local for relevante, ENRIQUEÇA com causa-raiz e impacto, não apenas reformule.
8. SEVERITY CALIBRADA — critical: perda de receita iminente OU SLA grave OU saúde<50; warning: tendência preocupante (queda > 25% em métrica chave); info: observação relevante; opportunity: padrão positivo a amplificar.
9. EXECUTIVE SUMMARY — 1-2 frases. Tom de diretoria. Sem jargão técnico. Mencione 1 número-chave e a recomendação macro.
10. DIAGNÓSTICO DE SAÚDE — alinhado com healthScore: <50 critical, 50-69 warning, 70-84 healthy, ≥85 excellent. Mas considere TENDÊNCIA também: score=72 caindo de 88 = warning.

ANTI-PADRÕES (EVITE)
- ❌ "Existem orçamentos atrasados" (raso, sem ação)
- ❌ "Backlog está alto" (genérico, sem corte)
- ❌ "Recomenda-se monitorar" (não-acionável)
- ❌ Recomendar relatórios genéricos como "fazer reunião"
- ❌ Repetir o que já está no painel (KPIs já são visíveis)

EXEMPLOS DE BOA ANÁLISE
- ✅ "3 orçamentos em 'aguardando info' há >7 dias travam R$ 280k em pipeline — comercial não acionou os clientes."
- ✅ "Conversão caiu de 32% para 18% (-44%) com throughput estável; gargalo migrou da produção para o fechamento."
- ✅ "João detém 67% do backlog atrasado e tem 2 itens vencidos; redistribuir o item ABC-12 (R$ 45k) para Maria libera SLA."

LINGUAGEM: pt-BR, direto, números com R$ formatado.

Retorne SEMPRE via a função 'emit_insights'. NUNCA texto livre.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "emit_insights",
    description: "Emit prioritized operational insights for the executive dashboard.",
    parameters: {
      type: "object",
      properties: {
        executiveSummary: {
          type: "string",
          description: "1-2 sentence overall assessment of operational health (PT-BR). Cite at least one specific number and a macro recommendation.",
        },
        healthDiagnosis: {
          type: "string",
          enum: ["excellent", "healthy", "warning", "critical"],
          description: "Overall operational health classification — must consider both score level AND trend.",
        },
        insights: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Short stable id, kebab-case." },
              severity: {
                type: "string",
                enum: ["critical", "warning", "info", "opportunity"],
              },
              title: { type: "string", description: "Headline (max ~90 chars, PT-BR). Include the most important number." },
              rootCause: { type: "string", description: "Causa-raiz específica em 1 frase, citando o sinal observado nos dados." },
              recommendation: { type: "string", description: "Ação concreta com verbo no imperativo, escopo ≤ 7 dias." },
              affectedCount: { type: "number", description: "How many budgets/items are affected (0 if N/A)." },
              estimatedImpactBRL: { type: "number", description: "Estimated financial impact in BRL (calculated from portfolioValue/revenue/avgTicket; 0 if N/A)." },
              actionPath: {
                type: "string",
                description: "Suggested route in the app (e.g. /admin/operacoes, /admin/comercial, /admin/financeiro).",
              },
            },
            required: ["id", "severity", "title", "rootCause", "recommendation", "affectedCount"],
            additionalProperties: false,
          },
        },
      },
      required: ["executiveSummary", "healthDiagnosis", "insights"],
      additionalProperties: false,
    },
  },
};

function fmtBRL(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "n/a";
  return `${n.toFixed(1)}%`;
}

function fmtChange(pct: number | null | undefined): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function buildUserPrompt(snapshot: MetricsSnapshot): string {
  const { kpis, period, funnels, aging, stalled, team, slaRisk } = snapshot;

  const monthly = (snapshot.monthlyFinancials ?? []).slice(-6);
  const stageEff = snapshot.stageEfficiency ?? [];
  const localAlerts = snapshot.localAlerts ?? [];
  const localInsights = snapshot.localInsights ?? [];
  const backlogByStatus = snapshot.backlogByStatus ?? [];
  const slaForecast = snapshot.slaForecast;

  return `# SNAPSHOT OPERACIONAL — ${period.days} dias (${period.from.slice(0, 10)} → ${period.to.slice(0, 10)})

## KPIs (atual vs anterior)
| Métrica | Atual | Anterior | Variação |
|---|---|---|---|
| Recebidos | ${kpis.received} | ${kpis.receivedPrev} | ${fmtChange(kpis.receivedChangePct)} |
| Backlog ativo | ${kpis.backlog} | — | ${kpis.backlogTrend ?? "—"} |
| Atrasados | ${kpis.overdue} | — | — |
| SLA no prazo | ${fmtPct(kpis.slaOnTime)} | — | — |
| Lead time médio (dias) | ${kpis.avgLeadTime?.toFixed(1) ?? "n/a"} | ${kpis.avgLeadTimePrev?.toFixed(1) ?? "n/a"} | — |
| Conversão | ${fmtPct(kpis.conversionRate)} | ${fmtPct(kpis.conversionRatePrev)} | — |
| Margem bruta | ${fmtPct(kpis.grossMargin)} | ${fmtPct(kpis.grossMarginPrev)} | — |
| Throughput / sem | ${kpis.throughputPerWeek?.toFixed(1) ?? "n/a"} | — | ${kpis.throughputTrend ?? "—"} |
| Receita fechada | ${fmtBRL(kpis.revenue)} | — | ${fmtChange(kpis.revenueChangePct)} |
| Ticket médio | ${fmtBRL(kpis.avgTicket)} | — | — |
| Valor em carteira | ${fmtBRL(kpis.portfolioValue)} | — | — |
| Contratos fechados | ${kpis.closedCount} | — | — |
| Health score | ${kpis.healthScore}/100 | — | — |
${kpis.healthFactors?.length ? `\nDecomposição do health score:\n${kpis.healthFactors.map((f) => `- ${f.label}: ${f.contribution}/${f.weight}`).join("\n")}` : ""}

## Funil operacional
${funnels.operational.map((s) => `- ${s.label}: ${s.count} (passRate ${s.passRate ?? "—"}%, drop ${s.drop})`).join("\n")}

## Funil comercial
${funnels.commercial.map((s) => `- ${s.label}: ${s.count} (passRate ${s.passRate ?? "—"}%, drop ${s.drop})`).join("\n")}

## Aging do backlog
${aging.map((a) => `- ${a.label}: ${a.count}`).join("\n")}

## Itens travados
${stalled.length ? stalled.map((s) => `- ${s.label}: ${s.count} itens, média ${s.avgDays} dias parados`).join("\n") : "(nenhum)"}

## Eficiência por estágio (apenas estágios com itens)
${stageEff.length ? stageEff.map((s) => `- ${s.label}: ${s.count} itens, ${s.avgDaysInStage}d em média (${s.efficiency})`).join("\n") : "(sem dados)"}

## Backlog por status
${backlogByStatus.length ? backlogByStatus.map((s) => `- ${s.label}: ${s.count}`).join("\n") : "(vazio)"}

## Equipe
${team.length ? team.map((m) => `- ${m.name}: ${m.activeBudgets} ativos · ${m.completedInPeriod} entregues no período · ${m.overdueCount} atrasados · ${m.waitingInfoCount} aguardando info · SLA ${m.slaRate}% · status ${m.health}${m.avgLeadTimeDays != null ? ` · lead ${m.avgLeadTimeDays}d` : ""}`).join("\n") : "(sem dados)"}

## Risco de SLA (próximas 48h)
${slaRisk.length ? slaRisk.slice(0, 8).map((r) => `- ${r.projectName} (${r.clientName}): ${r.hoursLeft}h${r.status ? ` · ${r.status}` : ""}`).join("\n") : "(nenhum)"}

## Forecast SLA (próximos 7 dias)
${slaForecast ? `- ${slaForecast.predictedBreaches7d} quebras previstas em ${slaForecast.riskBudgets} itens em risco (confiança ${slaForecast.confidence})` : "(indisponível)"}

## Receita mensal (últimos meses)
${monthly.length ? monthly.map((m) => `- ${m.month}: receita ${fmtBRL(m.revenue)} · custo ${fmtBRL(m.cost)} · lucro ${fmtBRL(m.profit)} · margem ${m.margin.toFixed(1)}%`).join("\n") : "(sem histórico)"}

## Alertas já calculados localmente (NÃO repita — enriqueça apenas se houver causa-raiz adicional)
${localAlerts.length ? localAlerts.map((a) => `- [${a.severity}] ${a.title}${a.count != null ? ` (${a.count})` : ""}`).join("\n") : "(nenhum)"}

## Sinais qualitativos do app
${localInsights.length ? localInsights.map((i) => `- [${i.type}] ${i.message}`).join("\n") : "(nenhum)"}

---

Analise e emita 3-6 insights priorizados via emit_insights. Lembre-se: NÃO REPITA os alertas locais — enriqueça com causa-raiz, cruzamento de dimensões e impacto financeiro.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const snapshot = body.snapshot as MetricsSnapshot | undefined;
    const persist = body.persist !== false; // default true
    if (!snapshot) {
      return new Response(JSON.stringify({ error: "Missing snapshot" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = buildUserPrompt(snapshot);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "emit_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições à IA atingido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione fundos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Falha ao gerar insights." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insights = JSON.parse(toolCall.function.arguments);
    const generatedAt = new Date().toISOString();

    // Persist to history (best-effort, non-blocking failure)
    if (persist) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const authHeader = req.headers.get("Authorization") ?? "";
        let userId: string | null = null;

        if (supabaseUrl && serviceKey && authHeader.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
          });
          if (userRes.ok) {
            const u = await userRes.json();
            userId = u?.id ?? null;
          } else {
            await userRes.text();
          }
        }

        if (supabaseUrl && serviceKey && userId) {
          const insertRes = await fetch(`${supabaseUrl}/rest/v1/operations_insights_history`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              generated_by: userId,
              generated_at: generatedAt,
              period_from: snapshot.period.from,
              period_to: snapshot.period.to,
              period_days: snapshot.period.days,
              health_diagnosis: insights.healthDiagnosis,
              health_score: snapshot.kpis.healthScore ?? null,
              executive_summary: insights.executiveSummary,
              insights: insights.insights ?? [],
              kpis_snapshot: snapshot.kpis,
            }),
          });
          if (!insertRes.ok) {
            const t = await insertRes.text();
            console.error("History insert failed:", insertRes.status, t);
          } else {
            await insertRes.text();
          }
        }
      } catch (persistErr) {
        console.error("Persist error (non-fatal):", persistErr);
      }
    }

    return new Response(JSON.stringify({ ...insights, generatedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("operations-insights error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
