/**
 * Edge function: generate-script
 *
 * Gera um roteiro de reunião personalizado para um perfil de cliente,
 * com streaming SSE compatível com o frontend (`ScriptBuilder.tsx`).
 *
 * Usa o Lovable AI Gateway (sem necessidade de API key extra). O modelo
 * padrão é `google/gemini-2.5-flash` — barato e rápido para texto longo.
 *
 * Auth: requer JWT válido (verify_jwt = true via comportamento padrão).
 * Apenas usuários autenticados conseguem chamar via UI; o gateway
 * rejeita chamadas sem token de qualquer forma.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProfileOption {
  type: string;
  description?: string;
  frequency?: string;
  approachStrategy?: string;
  pitfalls?: string;
}

interface RequestBody {
  profileType?: string;
  profileData?: ProfileOption;
  dashboardContext?: Record<string, unknown>;
}

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function buildPrompt(profile: ProfileOption, ctx: Record<string, unknown>): string {
  const safe = (v: unknown) =>
    v === undefined || v === null
      ? "—"
      : typeof v === "string"
        ? v
        : JSON.stringify(v).slice(0, 1500);

  return [
    `Você é um especialista em vendas consultivas de reformas de alto padrão.`,
    `Gere um roteiro de reunião comercial em Markdown (PT-BR) para o perfil "${profile.type}".`,
    ``,
    `## Perfil do cliente`,
    `- Descrição: ${safe(profile.description)}`,
    `- Frequência observada: ${safe(profile.frequency)}`,
    `- Estratégia de abordagem sugerida: ${safe(profile.approachStrategy)}`,
    `- Armadilhas comuns: ${safe(profile.pitfalls)}`,
    ``,
    `## Contexto consolidado de reuniões anteriores`,
    `- Objeções recorrentes: ${safe(ctx.objections)}`,
    `- Objeções ocultas: ${safe(ctx.hiddenObjections)}`,
    `- Argumentos de fechamento que funcionaram: ${safe(ctx.closingArguments)}`,
    `- Sinais de compra: ${safe(ctx.buyingSignals)}`,
    `- Perguntas mais frequentes: ${safe(ctx.topQuestions)}`,
    `- Buyer persona: ${safe(ctx.buyerPersona)}`,
    ``,
    `## Estrutura obrigatória do roteiro`,
    `1. **Abertura** (rapport, 2-3 frases)`,
    `2. **Descoberta** (3-5 perguntas-chave para esse perfil)`,
    `3. **Apresentação de valor** (foco no que importa para esse perfil)`,
    `4. **Tratamento de objeções** (top 3 esperadas, com resposta)`,
    `5. **Fechamento** (call-to-action específico, próximo passo)`,
    ``,
    `Use ## para títulos de seção, ### para subtítulos, **negrito** para destaques,`,
    `- para listas e > para falas sugeridas. Seja direto, prático e específico.`,
    `Não invente dados que não estão no contexto.`,
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const profile = body.profileData;
  if (!profile || typeof profile.type !== "string" || profile.type.length === 0) {
    return new Response(
      JSON.stringify({ error: "profileData.type é obrigatório" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const prompt = buildPrompt(profile, body.dashboardContext ?? {});

  const upstream = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em vendas consultivas de reformas de alto padrão no mercado de São Paulo. Responda sempre em português do Brasil, em Markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    const errText = await upstream.text().catch(() => "");
    let message = "Falha ao gerar roteiro.";
    if (status === 429) {
      message =
        "Muitas solicitações em pouco tempo. Aguarde alguns instantes e tente novamente.";
    } else if (status === 402) {
      message =
        "Sem créditos suficientes no workspace para gerar o roteiro. Adicione créditos em Configurações → IA.";
    }
    return new Response(
      JSON.stringify({ error: message, upstream_status: status, detail: errText.slice(0, 500) }),
      {
        status: status === 429 || status === 402 ? status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Repassa o stream SSE direto ao cliente — o frontend já sabe parsear `data: {...}\n\n`.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
