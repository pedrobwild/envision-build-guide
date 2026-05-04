// Edge function: ai-data-analyst
//
// Recebe um AnalysisResult JÁ CALCULADO pelo cliente (camada
// `src/lib/data-analysis`) e devolve narrativa em pt-BR no schema estrito
// AiInterpretation. A IA NÃO recalcula números — só interpreta.
//
// Princípios:
//   1. Validação Zod no body (request) e na resposta do LLM.
//   2. Hard cap de payload (PAYLOAD_LIMIT_BYTES).
//   3. Rate limit por user_id (10 req/min).
//   4. Auth obrigatória (Bearer JWT). Sem JWT, 401.
//   5. JSON estrito via tool calling — sem texto livre.
//   6. Distinção fact / inference / hypothesis exigida em cada keyFinding.
//   7. Logs sem PII e sem dataset cru.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Limites & rate limit ───────────────────────────────────────────────
const PAYLOAD_LIMIT_BYTES = 1_048_576; // 1 MB
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRate(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Schema mínimo do AnalysisResult que aceitamos ──────────────────────
// Não revalidamos o objeto inteiro (frontend já fez); apenas garantimos
// shape mínimo + aplicamos defesa contra payloads imensos.
const ProvenanceSchema = z.object({
  source: z.string(),
  datasetId: z.string(),
  columns: z.array(z.string()),
  params: z.record(z.unknown()).optional(),
});

const InsightInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  nature: z.enum(["fact", "inference", "hypothesis"]),
  confidence: z.enum(["low", "medium", "high"]),
  severity: z.enum(["info", "warning", "critical"]),
  evidence: z.array(z.object({ label: z.string(), value: z.union([z.number(), z.string()]) })),
  provenance: ProvenanceSchema,
});

const RequestSchema = z.object({
  datasetMeta: z.object({
    id: z.string(),
    name: z.string(),
    rowCount: z.number().int().nonnegative(),
    columnCount: z.number().int().nonnegative(),
  }),
  result: z.object({
    confidence: z.enum(["low", "medium", "high"]),
    insights: z.array(InsightInputSchema).max(50),
    qualityIssues: z
      .array(
        z.object({
          kind: z.string(),
          severity: z.enum(["info", "warning", "critical"]),
          message: z.string(),
        }),
      )
      .max(50)
      .optional(),
    limitations: z.array(z.string()).max(20),
  }),
  question: z.string().max(2000).optional(),
});

// ─── Schema da saída obrigatória do LLM ─────────────────────────────────
const InterpretationSchema = z.object({
  executiveSummary: z.string().min(1).max(2000),
  keyFindings: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1).max(1500),
        nature: z.enum(["fact", "inference", "hypothesis"]),
        backedBy: z.array(z.string()).min(1),
      }),
    )
    .max(20),
  dataQualityWarnings: z.array(z.string()).max(20),
  recommendedAnalyses: z.array(z.string()).max(20),
  businessRecommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        rationale: z.string().min(1).max(1000),
        action: z.string().min(1).max(500),
      }),
    )
    .max(20),
  confidence: z.enum(["low", "medium", "high"]),
  limitations: z.array(z.string()).max(20),
});

// ─── System prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um analista de dados sênior auxiliando gestores BWild.

# Princípios INVIOLÁVEIS
1. **Nunca invente números.** Toda métrica que aparecer na sua resposta DEVE
   estar presente em \`result.insights[].evidence\` ou ser uma referência
   qualitativa ("aumento", "queda") ao texto dos insights. Se um número não
   está nos insights recebidos, NÃO escreva.
2. **Distinga sempre fato | inferência | hipótese:**
   - **fact**: número/condição literalmente presente em \`evidence\`.
   - **inference**: dedução estatística razoável (ex.: correlação implica relação).
   - **hypothesis**: causalidade não testada, conjectura sobre motivo.
3. **Sem causalidade sem método.** Se você sugerir causa, marque como
   "hypothesis" e descreva como o usuário poderia testar (A/B, controle, etc.).
4. **Calibre confidence:**
   - high: insights de confiança "high" e r²>0.6 ou n grande.
   - medium: mistura.
   - low: pelo menos um insight de confiança "low" ou warnings críticos.
5. **Limitações sempre presentes** quando r²<0.3, amostra <20, ou data
   quality issues "warning"/"critical".
6. **Pt-BR profissional, conciso, direto.** Use o tratamento "você".
7. **NÃO peça mais dados** a não ser que seja indispensável para responder
   à pergunta. O foco é interpretar o que já foi calculado.
8. **Saída JSON estrita** via a função \`emit_interpretation\`. Cada
   keyFinding DEVE referenciar IDs reais de \`result.insights\` no campo
   \`backedBy\`.

# Estrutura da resposta
- \`executiveSummary\`: 2-4 frases. Direto. Sem números inventados.
- \`keyFindings\`: até 5. Cada uma cita \`backedBy\` (insight IDs).
- \`dataQualityWarnings\`: derive de \`qualityIssues\` recebidas, em pt-BR
  para o usuário não-técnico.
- \`recommendedAnalyses\`: próximos passos analíticos (ex.: "rodar
  segmentação por região"). Não são ações de negócio — são ações
  ANALÍTICAS.
- \`businessRecommendations\`: ações de negócio acionáveis. Cada uma com
  rationale (de qual insight saiu) e action (verbo no infinitivo).
- \`limitations\`: o que os dados NÃO permitem dizer.

NUNCA invente um insight ID em \`backedBy\` — só use os que vieram em
\`result.insights\`.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "emit_interpretation",
    description: "Emit final structured interpretation. Required.",
    parameters: {
      type: "object",
      properties: {
        executiveSummary: { type: "string", maxLength: 2000 },
        keyFindings: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              nature: { type: "string", enum: ["fact", "inference", "hypothesis"] },
              backedBy: { type: "array", items: { type: "string" } },
            },
            required: ["title", "description", "nature", "backedBy"],
          },
        },
        dataQualityWarnings: { type: "array", maxItems: 20, items: { type: "string" } },
        recommendedAnalyses: { type: "array", maxItems: 20, items: { type: "string" } },
        businessRecommendations: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              rationale: { type: "string" },
              action: { type: "string" },
            },
            required: ["title", "rationale", "action"],
          },
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        limitations: { type: "array", maxItems: 20, items: { type: "string" } },
      },
      required: [
        "executiveSummary",
        "keyFindings",
        "dataQualityWarnings",
        "recommendedAnalyses",
        "businessRecommendations",
        "confidence",
        "limitations",
      ],
    },
  },
};

// ─── Auth ───────────────────────────────────────────────────────────────
async function getUserId(authHeader: string | null, supabaseUrl: string, anonKey: string): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.id === "string" ? u.id : null;
  } catch {
    return null;
  }
}

// ─── Server ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    // 1. Auth
    const userId = await getUserId(req.headers.get("authorization"), SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    // 2. Rate limit
    if (!checkRate(userId)) {
      return json(
        { error: `Rate limit exceeded (${RATE_LIMIT_MAX}/min). Tente novamente em alguns segundos.` },
        429,
      );
    }

    // 3. Payload size
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > PAYLOAD_LIMIT_BYTES) {
      return json({ error: `Payload excede ${PAYLOAD_LIMIT_BYTES} bytes.` }, 413);
    }

    // 4. Parse + validate
    let parsed: z.infer<typeof RequestSchema>;
    try {
      parsed = RequestSchema.parse(JSON.parse(raw));
    } catch (e) {
      return json({ error: "Payload inválido", detail: errorMessage(e) }, 400);
    }

    // 5. Build messages
    const userPayload = {
      datasetMeta: parsed.datasetMeta,
      question: parsed.question ?? "",
      result: parsed.result,
    };
    const userContent =
      `Pergunta do usuário: ${parsed.question?.trim() || "(não informada — gere uma interpretação geral)"}\n\n` +
      `Dataset: ${parsed.datasetMeta.name} (${parsed.datasetMeta.rowCount} linhas, ${parsed.datasetMeta.columnCount} colunas)\n\n` +
      `Resultados pré-calculados (USE APENAS OS NÚMEROS PRESENTES AQUI):\n` +
      "```json\n" +
      JSON.stringify(userPayload.result, null, 2) +
      "\n```";

    // 6. Call gateway
    const t0 = Date.now();
    const gatewayResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "emit_interpretation" } },
        max_tokens: 2048,
      }),
    });

    if (!gatewayResp.ok) {
      const text = await gatewayResp.text().catch(() => "");
      console.error("ai-data-analyst gateway failed", gatewayResp.status, text.slice(0, 500));
      return json({ error: "Falha no gateway de IA" }, 502);
    }

    const completion = await gatewayResp.json();
    const toolCall = completion?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return json({ error: "IA não devolveu interpretação estruturada." }, 502);
    }

    // 7. Validate LLM output
    let interpretation: z.infer<typeof InterpretationSchema>;
    try {
      const argsRaw = JSON.parse(toolCall.function.arguments);
      interpretation = InterpretationSchema.parse(argsRaw);
    } catch (e) {
      console.error("ai-data-analyst invalid LLM output", errorMessage(e));
      return json({ error: "IA retornou JSON inválido — não exibido por segurança." }, 502);
    }

    // 8. Verifica que backedBy referencia IDs reais. Se não, marca limitation.
    const realIds = new Set(parsed.result.insights.map((i) => i.id));
    const inventedRefs = new Set<string>();
    for (const f of interpretation.keyFindings) {
      for (const id of f.backedBy) {
        if (!realIds.has(id)) inventedRefs.add(id);
      }
    }
    if (inventedRefs.size > 0) {
      interpretation.limitations.push(
        `Algumas referências da IA não puderam ser verificadas (${inventedRefs.size}). ` +
          "Ignoramos essas referências automaticamente.",
      );
      interpretation.keyFindings = interpretation.keyFindings.map((f) => ({
        ...f,
        backedBy: f.backedBy.filter((id) => realIds.has(id)),
      }));
    }

    return json(
      {
        interpretation,
        meta: {
          latencyMs: Date.now() - t0,
          datasetId: parsed.datasetMeta.id,
          insightCount: parsed.result.insights.length,
          inventedReferencesDropped: inventedRefs.size,
        },
      },
      200,
    );
  } catch (e) {
    console.error("ai-data-analyst unexpected error", errorMessage(e));
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
