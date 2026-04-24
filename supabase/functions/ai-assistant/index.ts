// =============================================================================
// AI Assistant — orquestrador com tool-calling + streaming SSE
// =============================================================================
//
// Recebe mensagens do usuário, executa o loop agente-tools e devolve a resposta
// em streaming (SSE) para o front-end. As tools expõem dados internos do
// BWild (orçamentos, clientes, leads, operações, catálogo, busca semântica) e
// inteligência de mercado via Perplexity.
//
// Segurança: exige JWT válido. Roles admin/comercial/orcamentista podem usar.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SSE_HEADERS = {
  ...corsHeaders,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

// -----------------------------------------------------------------------------
// Tipos
// -----------------------------------------------------------------------------
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

interface RequestBody {
  conversationId?: string;
  message: string;
  allowMarketSearch?: boolean;
  maxSteps?: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const decodeJwtPayload = (token: string) => {
  const [, payload = ""] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { sub?: string; exp?: number };
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sseEvent = (encoder: TextEncoder, event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

// -----------------------------------------------------------------------------
// System prompt
// -----------------------------------------------------------------------------
const SYSTEM_PROMPT = `Você é o Assistente BWild, um copiloto de IA para gestão de obras, orçamentos, CRM e operações.

DIRETRIZES
- Responda sempre em Português do Brasil, claro, objetivo e profissional.
- Use Markdown leve (listas, negrito, tabelas quando fizer sentido).
- Chame ferramentas SEMPRE que a pergunta depender de dados internos do sistema (orçamentos, clientes, leads, catálogo, métricas) — não invente números.
- Para perguntas sobre MERCADO, TENDÊNCIAS, CONCORRENTES ou PREÇOS EXTERNOS, use a ferramenta \`search_market\`.
- Combine dados internos + mercado quando fizer sentido (ex.: comparar margens internas com benchmarks).
- Cite fontes: ao usar \`search_market\`, inclua os links retornados ao final da resposta.
- Se faltar dado, diga claramente o que falta em vez de chutar.
- Nunca exponha IDs internos brutos ao usuário a menos que solicitado.
- Seja conciso por padrão; expanda quando o usuário pedir detalhes.`;

// -----------------------------------------------------------------------------
// Tool definitions (formato OpenAI / compatível com function-calling)
// -----------------------------------------------------------------------------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_budgets",
      description:
        "Lista e filtra orçamentos internos (status, cliente, período, valor). Use para perguntas sobre obras, propostas, conversão e pipeline.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Filtra por status (ex.: pending, approved, rejected).",
          },
          client_search: { type: "string", description: "Busca textual por cliente." },
          since_days: { type: "integer", description: "Janela em dias. Padrão 90." },
          limit: { type: "integer", description: "Máximo de registros (padrão 20, máx 50)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_clients",
      description: "Busca clientes/leads no CRM por nome, telefone ou e-mail.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Termo de busca." },
          limit: { type: "integer" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_operations_metrics",
      description:
        "Retorna métricas consolidadas de operação: total de orçamentos, aprovados, pendentes, receita aprovada. Use quando pedirem 'visão geral', 'como está o mês', KPIs, dashboard, forecast.",
      parameters: {
        type: "object",
        properties: {
          since_days: { type: "integer", description: "Janela em dias (padrão 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Busca itens do catálogo (materiais, serviços) por termo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Busca semântica (RAG) no conhecimento indexado do sistema: orçamentos, insights, documentos. Use para perguntas abertas/complexas sobre conteúdo interno.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          source_types: {
            type: "array",
            items: { type: "string" },
            description: "Filtra por tipo (budget, client, lead, catalog, insight, doc).",
          },
          limit: { type: "integer" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_market",
      description:
        "Pesquisa informações de MERCADO, CONCORRENTES, TENDÊNCIAS e PREÇOS externos via Perplexity. Retorna resposta + citações.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          recency: {
            type: "string",
            enum: ["day", "week", "month", "year"],
            description: "Recorte de recência.",
          },
        },
        required: ["query"],
      },
    },
  },
];

// -----------------------------------------------------------------------------
// Tool executor
// -----------------------------------------------------------------------------
async function executeTool(
  name: string,
  args: Record<string, any>,
  ctx: { supabase: any; serviceClient: any; authHeader: string; allowMarketSearch: boolean },
): Promise<{ output: string; meta?: Record<string, unknown> }> {
  try {
    switch (name) {
      case "query_budgets": {
        const sinceDays = Number(args.since_days) || 90;
        const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 50);
        let query = ctx.supabase
          .from("budgets")
          .select("id, name, status, total_value, created_at, client_name, client_id")
          .gte(
            "created_at",
            new Date(Date.now() - sinceDays * 864e5).toISOString(),
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (args.status) query = query.eq("status", args.status);
        if (args.client_search) query = query.ilike("client_name", `%${args.client_search}%`);
        const { data, error } = await query;
        if (error) throw error;
        return { output: JSON.stringify({ count: data?.length ?? 0, rows: data ?? [] }) };
      }

      case "query_clients": {
        const term = String(args.search || "").trim();
        const limit = Math.min(Math.max(Number(args.limit) || 15, 1), 50);
        if (!term) return { output: JSON.stringify({ rows: [], note: "search vazio" }) };
        const { data, error } = await ctx.supabase
          .from("clients")
          .select("id, name, email, phone, created_at, status")
          .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(limit);
        if (error) {
          return {
            output: JSON.stringify({
              rows: [],
              warning: "tabela clients indisponível",
              detail: error.message,
            }),
          };
        }
        return { output: JSON.stringify({ count: data?.length ?? 0, rows: data ?? [] }) };
      }

      case "get_operations_metrics": {
        const sinceDays = Number(args.since_days) || 30;
        const { data, error } = await ctx.supabase.rpc("ai_operations_summary", {
          since_days: sinceDays,
        });
        if (error) throw error;
        return { output: JSON.stringify(data) };
      }

      case "search_catalog": {
        const term = String(args.query || "").trim();
        const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
        if (!term) return { output: JSON.stringify({ rows: [] }) };
        const { data, error } = await ctx.supabase
          .from("catalog_items")
          .select("id, name, unit, category, base_price")
          .ilike("name", `%${term}%`)
          .limit(limit);
        if (error) {
          return {
            output: JSON.stringify({
              rows: [],
              warning: "tabela catalog_items indisponível",
              detail: error.message,
            }),
          };
        }
        return { output: JSON.stringify({ count: data?.length ?? 0, rows: data ?? [] }) };
      }

      case "semantic_search": {
        const term = String(args.query || "").trim();
        if (!term) return { output: JSON.stringify({ matches: [] }) };
        const queryEmbedding = await embed(term);
        if (!queryEmbedding) {
          return {
            output: JSON.stringify({
              matches: [],
              warning: "embeddings desabilitados (OPENAI_API_KEY ausente)",
            }),
          };
        }
        const { data, error } = await ctx.serviceClient.rpc("ai_match_embeddings", {
          query_embedding: queryEmbedding,
          match_count: Math.min(Math.max(Number(args.limit) || 8, 1), 20),
          source_types: Array.isArray(args.source_types) ? args.source_types : null,
          min_similarity: 0.7,
        });
        if (error) throw error;
        return { output: JSON.stringify({ matches: data ?? [] }) };
      }

      case "search_market": {
        if (!ctx.allowMarketSearch) {
          return {
            output: JSON.stringify({
              error: "busca de mercado desativada para esta sessão",
            }),
          };
        }
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/perplexity-search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: ctx.authHeader,
          },
          body: JSON.stringify({
            query: args.query,
            recency: args.recency ?? "month",
          }),
        });
        const text = await resp.text();
        if (!resp.ok) {
          return {
            output: JSON.stringify({
              error: "falha na busca de mercado",
              status: resp.status,
              detail: text.slice(0, 500),
            }),
          };
        }
        return { output: text };
      }

      default:
        return { output: JSON.stringify({ error: `tool desconhecida: ${name}` }) };
    }
  } catch (err) {
    return {
      output: JSON.stringify({
        error: "tool_failed",
        tool: name,
        message: err instanceof Error ? err.message : String(err),
      }),
    };
  }
}

// -----------------------------------------------------------------------------
// Embeddings (OpenAI) — usado pelo semantic_search
// -----------------------------------------------------------------------------
async function embed(text: string): Promise<number[] | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.data?.[0]?.embedding ?? null;
}

// -----------------------------------------------------------------------------
// LLM call — OpenAI chat.completions com streaming + tool_calls
// -----------------------------------------------------------------------------
async function callLLM(messages: ChatMessage[], stream: boolean) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY não configurada");
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      stream,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LLM erro ${resp.status}: ${t.slice(0, 400)}`);
  }
  return resp;
}

// Lê um stream OpenAI SSE e acumula tool_calls + content.
async function consumeStream(
  resp: Response,
  onDelta: (text: string) => void,
): Promise<{ content: string; toolCalls: any[] }> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCallsMap = new Map<number, any>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === "string" && delta.content.length > 0) {
          content += delta.content;
          onDelta(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const existing = toolCallsMap.get(idx) ?? {
              id: tc.id,
              type: "function",
              function: { name: "", arguments: "" },
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.function.name += tc.function.name;
            if (tc.function?.arguments)
              existing.function.arguments += tc.function.arguments;
            toolCallsMap.set(idx, existing);
          }
        }
      } catch {
        /* ignora chunks não-json */
      }
    }
  }
  return { content, toolCalls: [...toolCallsMap.values()] };
}

// -----------------------------------------------------------------------------
// Main handler
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "method_not_allowed" });

  // ---- Auth ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse(401, { error: "not_authenticated" });
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return jsonResponse(401, { error: "invalid_token" });

  let callerId: string;
  try {
    const payload = decodeJwtPayload(token);
    if (!payload.sub) throw new Error("missing sub");
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
      throw new Error("expired");
    callerId = payload.sub;
  } catch (e) {
    return jsonResponse(401, {
      error: "invalid_token",
      detail: e instanceof Error ? e.message : "jwt",
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SRV, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Checa role (admin/comercial/orcamentista)
  const { data: roles } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId);
  const allowed = ["admin", "comercial", "orcamentista"];
  const hasRole = Array.isArray(roles) && roles.some((r: any) => allowed.includes(r.role));
  if (!hasRole) return jsonResponse(403, { error: "forbidden" });

  // ---- Body ----
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }
  if (!body.message || typeof body.message !== "string")
    return jsonResponse(400, { error: "missing_message" });

  const maxSteps = Math.min(Math.max(Number(body.maxSteps) || 6, 1), 10);
  const allowMarketSearch = body.allowMarketSearch !== false;

  // ---- Conversa ----
  let conversationId = body.conversationId;
  if (!conversationId) {
    const { data: conv, error: convErr } = await userClient
      .from("ai_conversations")
      .insert({
        user_id: callerId,
        title: body.message.slice(0, 60),
      })
      .select("id")
      .single();
    if (convErr || !conv) return jsonResponse(500, { error: "conv_insert_failed" });
    conversationId = conv.id;
  }

  // Busca histórico (últimas 20 mensagens)
  const { data: history } = await userClient
    .from("ai_messages")
    .select("role, content, tool_calls, tool_name, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Persiste mensagem do usuário
  await userClient.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: callerId,
    role: "user",
    content: body.message,
  });

  // Monta payload do LLM
  const chatMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(history ?? [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: body.message },
  ];

  // ---- Streaming SSE ----
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(sseEvent(encoder, event, data));

      try {
        send("meta", { conversationId });

        const citations: any[] = [];
        let finalContent = "";

        for (let step = 0; step < maxSteps; step++) {
          const resp = await callLLM(chatMessages, true);
          const { content, toolCalls } = await consumeStream(resp, (delta) => {
            send("delta", { text: delta });
          });

          // Se houver tool_calls, executa e loopa
          if (toolCalls.length > 0) {
            chatMessages.push({
              role: "assistant",
              content: content || "",
              tool_calls: toolCalls,
            } as any);

            for (const tc of toolCalls) {
              let parsedArgs: Record<string, any> = {};
              try {
                parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
              } catch {
                parsedArgs = {};
              }
              send("tool", {
                name: tc.function.name,
                args: parsedArgs,
              });
              const result = await executeTool(tc.function.name, parsedArgs, {
                supabase: userClient,
                serviceClient,
                authHeader,
                allowMarketSearch,
              });
              // Coleta citações de search_market
              if (tc.function.name === "search_market") {
                try {
                  const parsed = JSON.parse(result.output);
                  if (Array.isArray(parsed.citations)) citations.push(...parsed.citations);
                  if (Array.isArray(parsed.sources)) citations.push(...parsed.sources);
                } catch {
                  /* ignore */
                }
              }
              chatMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                name: tc.function.name,
                content: result.output,
              });
              send("tool_result", {
                name: tc.function.name,
                preview: result.output.slice(0, 400),
              });
            }
            continue;
          }

          finalContent = content;
          break;
        }

        // Persiste resposta
        await userClient.from("ai_messages").insert({
          conversation_id: conversationId,
          user_id: callerId,
          role: "assistant",
          content: finalContent,
          citations: citations.length ? citations : null,
          model: Deno.env.get("AI_MODEL") || "gpt-4o-mini",
        });

        send("done", { conversationId, citations });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
