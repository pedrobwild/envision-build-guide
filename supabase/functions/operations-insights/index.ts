// Edge function: operations-insights
// Receives a snapshot of operational metrics and returns AI-generated insights
// (prioritized alerts, root-cause hypotheses, recommendations, health score).
//
// Uses Lovable AI Gateway with GPT-5 (reasoning enabled) and structured tool calling.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricsSnapshot {
  period: { from: string; to: string; days: number };
  kpis: {
    received: number;
    receivedPrev: number;
    backlog: number;
    overdue: number;
    slaOnTime: number;
    avgLeadTime: number | null;
    conversionRate: number | null;
    grossMargin: number | null;
    portfolioValue: number;
    closedCount: number;
    revenue: number;
    throughputPerWeek: number | null;
    healthScore: number;
  };
  funnels: {
    operational: Array<{ label: string; count: number; passRate: number | null; drop: number }>;
    commercial: Array<{ label: string; count: number; passRate: number | null; drop: number }>;
  };
  aging: Array<{ label: string; count: number }>;
  stalled: Array<{ label: string; count: number; avgDays: number }>;
  team: Array<{ name: string; activeBudgets: number; overdueCount: number; slaRate: number; health: string }>;
  slaRisk: Array<{ projectName: string; clientName: string; hoursLeft: number }>;
}

const SYSTEM_PROMPT = `Você é um analista sênior de operações de uma empresa de orçamentos de reformas e construção.
Receberá um snapshot de métricas operacionais. Sua missão:

1. Identificar os 3-5 problemas/oportunidades mais críticos (não liste tudo — priorize impacto).
2. Para cada um: explique a causa-raiz provável em 1 frase e sugira UMA ação concreta.
3. Calibre severity: critical=perda de receita iminente ou SLA quebrado; warning=tendência preocupante; info=observação relevante; opportunity=padrão positivo a amplificar.
4. Use linguagem direta de gestão (PT-BR). Evite jargão técnico. Números devem ser específicos.
5. NÃO repita métricas óbvias do dashboard — entregue interpretação.

Exemplos de boa análise:
- ✅ "3 orçamentos em 'aguardando info' há mais de 7 dias travam R$ 280k em pipeline"
- ❌ "Existem orçamentos atrasados" (raso, sem ação)

Retorne SEMPRE via a função 'emit_insights'.`;

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
          description: "1-2 sentence overall assessment of operational health (PT-BR).",
        },
        healthDiagnosis: {
          type: "string",
          enum: ["excellent", "healthy", "warning", "critical"],
          description: "Overall operational health classification.",
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
              title: { type: "string", description: "Headline (max ~80 chars, PT-BR)." },
              rootCause: { type: "string", description: "Causa-raiz provável em 1 frase." },
              recommendation: { type: "string", description: "Ação concreta sugerida (1 frase, verbo no imperativo)." },
              affectedCount: { type: "number", description: "How many budgets/items are affected (0 if N/A)." },
              estimatedImpactBRL: { type: "number", description: "Estimated financial impact in BRL (0 if N/A)." },
              actionPath: {
                type: "string",
                description: "Suggested route in the app (e.g. /admin/operacoes).",
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

    const userPrompt = `Snapshot operacional do período (${snapshot.period.days} dias):

KPIs:
- Recebidos: ${snapshot.kpis.received} (anterior: ${snapshot.kpis.receivedPrev})
- Backlog ativo: ${snapshot.kpis.backlog} | Atrasados: ${snapshot.kpis.overdue}
- SLA no prazo: ${snapshot.kpis.slaOnTime.toFixed(1)}%
- Lead time médio: ${snapshot.kpis.avgLeadTime?.toFixed(1) ?? "n/a"} dias
- Taxa de conversão: ${snapshot.kpis.conversionRate?.toFixed(1) ?? "n/a"}%
- Throughput semanal: ${snapshot.kpis.throughputPerWeek?.toFixed(1) ?? "n/a"} entregas/sem
- Margem bruta: ${snapshot.kpis.grossMargin?.toFixed(1) ?? "n/a"}%
- Receita fechada: R$ ${snapshot.kpis.revenue.toLocaleString("pt-BR")}
- Valor em carteira: R$ ${snapshot.kpis.portfolioValue.toLocaleString("pt-BR")}
- Contratos fechados: ${snapshot.kpis.closedCount}
- Health score atual (0-100): ${snapshot.kpis.healthScore}

Funil operacional:
${snapshot.funnels.operational.map((s) => `  ${s.label}: ${s.count} (passRate ${s.passRate ?? "n/a"}%, drop ${s.drop})`).join("\n")}

Funil comercial:
${snapshot.funnels.commercial.map((s) => `  ${s.label}: ${s.count} (passRate ${s.passRate ?? "n/a"}%, drop ${s.drop})`).join("\n")}

Aging do backlog:
${snapshot.aging.map((a) => `  ${a.label}: ${a.count}`).join("\n")}

Itens travados:
${snapshot.stalled.map((s) => `  ${s.label}: ${s.count} itens, ${s.avgDays} dias parados em média`).join("\n") || "  (nenhum)"}

Equipe:
${snapshot.team.map((m) => `  ${m.name}: ${m.activeBudgets} ativos, ${m.overdueCount} atrasados, SLA ${m.slaRate}%, status ${m.health}`).join("\n") || "  (sem dados)"}

Risco de SLA (próximas 48h):
${snapshot.slaRisk.slice(0, 5).map((r) => `  ${r.projectName} (${r.clientName}): ${r.hoursLeft}h`).join("\n") || "  (nenhum)"}

Analise e emita insights via emit_insights.`;

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
