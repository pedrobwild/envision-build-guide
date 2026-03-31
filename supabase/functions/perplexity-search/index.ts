import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const decodeJwtPayload = (token: string) => {
  const [, payload = ""] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { sub?: string; exp?: number };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = tokenMatch?.[1]?.trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "Invalid token", detail: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-context client to validate the caller's token
    let callerId: string | undefined;
    try {
      const payload = decodeJwtPayload(token);
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (!payload.sub || (payload.exp && payload.exp < nowInSeconds)) {
        throw new Error("Expired or malformed token");
      }
      callerId = payload.sub;
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid token", detail: error instanceof Error ? error.message : "Malformed JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-context client to validate access via RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check admin role
    const { data: roleData, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, mode } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "Você é um assistente especializado em softwares de gestão de obras e reformas residenciais. Responda em português brasileiro de forma clara e estruturada.";

    if (mode === "benchmarking") {
      systemPrompt = `Você é um analista de produto especializado em benchmarking de softwares de gestão de obras e reformas residenciais. 
Analise softwares concorrentes como Houzz, Buildertrend, CoConstruct, Procore, Construct Connect, Veja Obra, Obra Prima, Sienge e similares.
Identifique funcionalidades inovadoras, tendências de mercado e oportunidades de diferenciação.
Responda em português brasileiro com sugestões concretas e acionáveis, organizando por categorias.`;
    } else if (mode === "references") {
      systemPrompt = `Você é um pesquisador especializado em tecnologia para construção civil e reformas residenciais.
Pesquise funcionalidades, tendências e melhores práticas de softwares de gestão de obras.
Responda em português brasileiro de forma detalhada com fontes quando possível.`;
    } else if (mode === "ux") {
      systemPrompt = `Você é um especialista em UX/UI para aplicações de gestão de obras e reformas residenciais.
Analise hierarquia de informação, copy, fluxos de usuário e sugestões de melhorias de experiência.
Responda em português brasileiro com sugestões práticas e priorizadas.`;
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Perplexity API error", detail: errText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const citations = data.citations ?? [];

    return new Response(JSON.stringify({ content, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("perplexity-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
