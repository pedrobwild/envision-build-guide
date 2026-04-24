// =============================================================================
// AI Embed — gera e mantém embeddings do conhecimento interno
// =============================================================================
//
// Pode ser chamada:
//   POST { mode: "full" }    — reindexação completa (apenas admin)
//   POST { mode: "item", source_type, source_id, content, metadata } — upsert 1 item
//
// Usa OPENAI_API_KEY e SUPABASE_SERVICE_ROLE_KEY (service role para escrever em
// ai_embeddings ignorando RLS).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const decodeJwtPayload = (token: string) => {
  const [, payload = ""] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as { sub?: string; exp?: number };
};

async function embed(text: string): Promise<number[]> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY ausente");
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    }),
  });
  if (!r.ok) throw new Error(`embeddings ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.data[0].embedding;
}

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += size - overlap) {
    out.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return out;
}

async function upsertChunks(
  serviceClient: any,
  sourceType: string,
  sourceId: string,
  content: string,
  metadata: Record<string, unknown> = {},
) {
  const chunks = chunkText(content);
  const rows = [];
  for (let i = 0; i < chunks.length; i++) {
    const vec = await embed(chunks[i]);
    rows.push({
      source_type: sourceType,
      source_id: sourceId,
      chunk_index: i,
      content: chunks[i],
      metadata,
      embedding: vec,
    });
  }
  const { error } = await serviceClient
    .from("ai_embeddings")
    .upsert(rows, { onConflict: "source_type,source_id,chunk_index" });
  if (error) throw error;
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "not_authenticated" });
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return json(401, { error: "invalid_token" });

  let callerId: string;
  try {
    const p = decodeJwtPayload(token);
    if (!p.sub) throw new Error("missing sub");
    if (p.exp && p.exp < Math.floor(Date.now() / 1000)) throw new Error("expired");
    callerId = p.sub;
  } catch (e) {
    return json(401, { error: "invalid_token", detail: (e as Error).message });
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

  // Somente admins disparam reindexação
  const { data: role } = await userClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return json(403, { error: "admin_required" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const mode = body?.mode ?? "item";

  try {
    if (mode === "item") {
      const { source_type, source_id, content, metadata } = body;
      if (!source_type || !source_id || !content)
        return json(400, { error: "missing_fields" });
      const n = await upsertChunks(
        serviceClient,
        source_type,
        String(source_id),
        String(content),
        metadata ?? {},
      );
      return json(200, { ok: true, chunks: n });
    }

    if (mode === "full") {
      // Indexa orçamentos recentes (últimos 180 dias)
      const { data: budgets } = await serviceClient
        .from("budgets")
        .select("id, name, client_name, status, total_value, notes, created_at")
        .gte("created_at", new Date(Date.now() - 180 * 864e5).toISOString())
        .limit(500);
      let total = 0;
      for (const b of budgets ?? []) {
        const txt = [
          `Orçamento: ${b.name ?? ""}`,
          `Cliente: ${b.client_name ?? ""}`,
          `Status: ${b.status ?? ""}`,
          `Valor: ${b.total_value ?? ""}`,
          `Notas: ${b.notes ?? ""}`,
          `Data: ${b.created_at ?? ""}`,
        ].join("\n");
        total += await upsertChunks(serviceClient, "budget", String(b.id), txt, {
          name: b.name,
          status: b.status,
        });
      }
      return json(200, { ok: true, mode: "full", indexed_budgets: budgets?.length ?? 0, chunks: total });
    }

    return json(400, { error: "unknown_mode" });
  } catch (err) {
    return json(500, {
      error: "embed_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});
