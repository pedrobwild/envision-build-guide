import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
- **Workspace de Produção**: orçamentista gerencia backlog, briefing, plantas, mídias.

# Status internos (internal_status)
\`novo\`, \`em_analise\`, \`waiting_info\` (Aguardando), \`em_revisao\`, \`revision_requested\`, \`delivered_to_sales\` (Entregue), \`published\`, \`minuta_solicitada\`, \`contrato_fechado\`, \`perdido\`.

# Papéis (RBAC)
\`admin\` (visão global), \`comercial\` (carteira + leads sem dono), \`orcamentista\` (produção).

# Integrações
Digisac (WhatsApp), HubSpot (deals), Meta Ads (lead webhook), Elephan (reuniões), Lovable Cloud (Supabase).

# Stack técnico
React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (RLS + Edge Functions Deno) + React Query + Framer Motion.

# Diretrizes de resposta
1. **Foco no orcamento-bwild**: quando a pergunta for ambígua, assuma o contexto deste projeto.
2. **Markdown** para listas, código (\`\`\`tsx), tabelas e ênfase — facilita a leitura no drawer.
3. **Seja específico**: cite nomes reais de páginas (ex: \`/admin/comercial\`), componentes (\`BudgetEditorV2\`), tabelas (\`budgets\`, \`budget_activities\`) e campos (\`internal_status\`, \`due_at\`) quando relevante.
4. **Respostas curtas por padrão**; expanda apenas se o usuário pedir detalhes.
5. **Não invente** rotas, tabelas ou features. Se não souber, diga e sugira onde verificar.
6. **Copy para clientes**: tom premium, claro, sem jargão técnico, focado em valor e tranquilidade.
7. **Privacidade**: nunca exponha custos internos, BDI ou margem em textos voltados ao cliente final.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "Chave OpenAI inválida ou expirada." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Falha ao chamar OpenAI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
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
