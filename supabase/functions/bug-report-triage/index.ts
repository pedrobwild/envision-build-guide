// supabase/functions/bug-report-triage/index.ts
//
// Triagem de bug reports por IA.
//
// 1. Modo "estender" (PATCH style): recebe um bug_id já criado pelo
//    componente BugReporter e enriquece com severity_ai, area_ai,
//    triage_summary, triage_tags, duplicate_of. Marca como triaged.
//
// 2. Modo "criar" (compat com a tool submit_bug_report do chat): recebe
//    os campos crus, cria o registro na tabela e em seguida triage.
//
// POST /functions/v1/bug-report-triage
// Body para modo "estender": { bug_id }
// Body para modo "criar":    { title, description, steps_to_reproduce, expected_behavior, actual_behavior, severity?, route?, ... }
//
// Resposta: { ok: true, bug_report: {...}, triage: {...}, duplicate_of }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_AREAS = [
  "auth", "dashboard", "comercial", "budget-editor", "public-budget",
  "catalog", "crm", "lead-sources", "agenda", "ai-assistant",
  "templates", "users", "system", "other",
] as const;

// ─── Triagem por IA ───────────────────────────────────────────────────────

const TRIAGE_SYSTEM = `Você é um engenheiro de QA do envision-build-guide (BWild Engine).
Receberá um bug report estruturado em pt-BR e deve devolver, em JSON estrito, a triagem.

Áreas válidas (escolha exatamente uma): ${ALLOWED_AREAS.join(", ")}.
Severidades válidas: low, medium, high, critical.

Critérios de severidade:
- critical: bloqueia trabalho, perda/corrupção de dados, falha de auth/permissão, erro em produção monetário
- high: impacta múltiplos usuários, fluxo crítico quebrado, sem workaround simples
- medium: funcionalidade secundária quebrada ou UX confusa em fluxo importante
- low: cosmético, edge case, microcopy, melhoria de UX

Devolva APENAS este JSON (sem markdown, sem comentário):
{
  "severity": "low|medium|high|critical",
  "area": "<uma das áreas>",
  "summary": "<1-2 frases em pt-BR resumindo o bug>",
  "tags": ["<tag1>", "<tag2>", "..."]
}`;

// deno-lint-ignore no-explicit-any
async function callTriageLLM(bug: any, lovableApiKey: string) {
  const userMsg = [
    `Título: ${bug.title}`,
    `Descrição: ${bug.description}`,
    bug.steps_to_reproduce ? `Passos:\n${bug.steps_to_reproduce}` : "",
    bug.expected_behavior ? `Esperado: ${bug.expected_behavior}` : "",
    bug.actual_behavior ? `Atual: ${bug.actual_behavior}` : "",
    bug.severity ? `Severidade declarada pelo usuário: ${bug.severity}` : "",
    bug.route ? `Rota: ${bug.route}` : "",
    bug.device_type ? `Device: ${bug.device_type} (${bug.os_name ?? ""} ${bug.browser_name ?? ""})` : "",
  ].filter(Boolean).join("\n");

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: TRIAGE_SYSTEM },
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    console.error("triage llm error", resp.status, await resp.text().catch(() => ""));
    return null;
  }
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    const severity = ["low","medium","high","critical"].includes(parsed.severity) ? parsed.severity : "medium";
    const area = (ALLOWED_AREAS as readonly string[]).includes(parsed.area) ? parsed.area : "other";
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 400) : (bug.title ?? "");
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t: unknown): t is string => typeof t === "string")
          .map((t: string) => t.trim().toLowerCase().replace(/\s+/g, "_"))
          .filter(Boolean).slice(0, 5)
      : [];
    return { severity, area, summary, tags };
  } catch (e) {
    console.error("triage llm parse error", e);
    return null;
  }
}

// ─── Anti-duplicata ───────────────────────────────────────────────────────

async function findPossibleDuplicate(
  excludeId: string | null,
  title: string,
  // deno-lint-ignore no-explicit-any
  admin: any,
): Promise<string | null> {
  const keywords = title.split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join(" ");
  if (!keywords) return null;
  let q = admin
    .from("bug_reports")
    .select("id, title")
    .ilike("title", `%${keywords}%`)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(5);
  if (excludeId) q = q.neq("id", excludeId);
  // deno-lint-ignore no-explicit-any
  const { data, error } = (await q) as any;
  if (error || !data || data.length === 0) return null;
  return data[0]?.id ?? null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

async function resolveUser(
  authHeader: string | null, supabaseUrl: string, serviceKey: string,
) {
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!authHeader?.startsWith("Bearer ")) return { userId: null as string | null, admin };
  const token = authHeader.slice("Bearer ".length).trim();
  // deno-lint-ignore no-explicit-any
  const { data: { user } } = (await admin.auth.getUser(token)) as any;
  return { userId: (user?.id ?? null) as string | null, admin };
}

// ─── Server ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const { userId, admin } = await resolveUser(req.headers.get("authorization"), supabaseUrl, serviceKey);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    // Modo estender: usuário já criou o bug via componente BugReporter
    let bugId: string | null = typeof body?.bug_id === "string" ? body.bug_id : null;

    // Modo criar: chamada vinda da tool submit_bug_report do chat
    if (!bugId) {
      const title = String(body.title ?? body.summary ?? "").trim();
      const description = String(body.description ?? body.summary ?? "").trim();
      const stepsToReproduce = String(body.steps_to_reproduce ?? body.steps ?? "").trim();
      const expected = String(body.expected_behavior ?? body.expected ?? "").trim();
      const actual = String(body.actual_behavior ?? body.actual ?? "").trim();
      if (title.length < 5 || description.length < 5) {
        return new Response(JSON.stringify({ error: "title e description (mín. 5 chars) obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const severityIn = String(body.severity ?? "medium");
      const severity = ["low","medium","high","critical"].includes(severityIn) ? severityIn : "medium";

      // deno-lint-ignore no-explicit-any
      const { data: ins, error: insErr } = (await admin
        .from("bug_reports")
        .insert({
          reporter_id: userId,
          reporter_name: typeof body.reporter_name === "string" ? body.reporter_name : null,
          reporter_email: typeof body.reporter_email === "string" ? body.reporter_email : null,
          title,
          description,
          steps_to_reproduce: stepsToReproduce || null,
          expected_behavior: expected || null,
          actual_behavior: actual || null,
          severity,
          status: "open",
          route: typeof body.route === "string" ? body.route : (typeof body.current_url === "string" ? body.current_url : null),
          user_role: typeof body.user_role === "string" ? body.user_role : null,
          device_type: typeof body.device_type === "string" ? body.device_type : null,
          os_name: typeof body.os_name === "string" ? body.os_name : (typeof body.os === "string" ? body.os : null),
          browser_name: typeof body.browser_name === "string" ? body.browser_name : null,
          browser_version: typeof body.browser_version === "string" ? body.browser_version : null,
          viewport_width: Number.isFinite(body.viewport_width) ? body.viewport_width : null,
          viewport_height: Number.isFinite(body.viewport_height) ? body.viewport_height : null,
          device_pixel_ratio: Number.isFinite(body.device_pixel_ratio) ? body.device_pixel_ratio : null,
          user_agent: typeof body.user_agent === "string" ? body.user_agent : (req.headers.get("user-agent") ?? null),
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
          active_filters: typeof body.active_filters === "object" && body.active_filters ? body.active_filters : {},
          console_errors: Array.isArray(body.console_errors) ? body.console_errors : [],
        })
        .select("*")
        .single()) as any;
      if (insErr) {
        console.error("insert bug_report error", insErr);
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      bugId = ins.id;
    }

    // Carrega o bug
    // deno-lint-ignore no-explicit-any
    const { data: bug, error: getErr } = (await admin
      .from("bug_reports")
      .select("*")
      .eq("id", bugId!)
      .maybeSingle()) as any;
    if (getErr || !bug) {
      return new Response(JSON.stringify({ error: getErr?.message ?? "bug não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Triagem por IA
    let triage = null;
    if (lovableApiKey) triage = await callTriageLLM(bug, lovableApiKey);
    const duplicateOf = await findPossibleDuplicate(bug.id, bug.title ?? "", admin);

    // Update
    // deno-lint-ignore no-explicit-any
    const { data: updated, error: upErr } = (await admin
      .from("bug_reports")
      .update({
        severity_ai: triage?.severity ?? null,
        area_ai: triage?.area ?? null,
        triage_summary: triage?.summary ?? null,
        triage_tags: triage?.tags ?? [],
        duplicate_of: duplicateOf,
        triaged_at: new Date().toISOString(),
        status: bug.status === "open" && triage ? "triaging" : bug.status,
      })
      .eq("id", bug.id)
      .select("*")
      .single()) as any;

    if (upErr) {
      console.error("update bug_report error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, bug_report: updated, triage, duplicate_of: duplicateOf }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bug-report-triage error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
