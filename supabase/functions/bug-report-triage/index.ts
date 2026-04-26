// Edge function: bug-report-triage
// Classifica um bug report usando Lovable AI (severidade, área, resumo, tags)
// e detecta possíveis duplicatas via similaridade de título.
//
// POST { bug_id: uuid }
// Resposta: { ok: true, triage: {...} } | { error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TRIAGE_TOOL = {
  type: "function",
  function: {
    name: "submit_triage",
    description: "Classifica o bug com severidade, área, resumo e tags.",
    parameters: {
      type: "object",
      properties: {
        severity_ai: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description:
            "Severidade. critical = bloqueia uso/derruba dados; high = funcionalidade importante quebrada; medium = problema com workaround; low = cosmético/menor.",
        },
        area_ai: {
          type: "string",
          description:
            "Área afetada em snake-case curto: ex. budget-editor, comercial, ai-assistant, dashboard, public-budget, integracoes, auth, mobile.",
        },
        triage_summary: {
          type: "string",
          description: "Resumo neutro de 1-2 frases (PT-BR) do problema relatado.",
        },
        triage_tags: {
          type: "array",
          items: { type: "string" },
          description: "3-6 tags em snake_case (ex.: pdf_export, regression, ios_safari, performance).",
        },
      },
      required: ["severity_ai", "area_ai", "triage_summary", "triage_tags"],
      additionalProperties: false,
    },
  },
} as const;

interface BugRow {
  id: string;
  title: string;
  description: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  severity: string | null;
  route: string | null;
  user_role: string | null;
  device_type: string | null;
  os_name: string | null;
  browser_name: string | null;
  console_errors: unknown;
}

async function callTriage(bug: BugRow) {
  const userPayload = {
    title: bug.title,
    description: bug.description,
    steps: bug.steps_to_reproduce,
    expected: bug.expected_behavior,
    actual: bug.actual_behavior,
    user_severity: bug.severity,
    context: {
      route: bug.route,
      role: bug.user_role,
      device: bug.device_type,
      os: bug.os_name,
      browser: bug.browser_name,
    },
    console_errors_sample: Array.isArray(bug.console_errors)
      ? (bug.console_errors as unknown[]).slice(0, 5)
      : null,
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Você é um engenheiro de QA triando bugs de uma plataforma SaaS de gestão de orçamentos de obras (BWild). " +
            "Classifique objetivamente. Áreas comuns: budget-editor, comercial, ai-assistant, dashboard, public-budget, " +
            "integracoes, auth, mobile, catalog, crm. Sempre responda chamando a tool submit_triage.",
        },
        {
          role: "user",
          content:
            "Classifique este bug:\n\n```json\n" + JSON.stringify(userPayload, null, 2) + "\n```",
        },
      ],
      tools: [TRIAGE_TOOL],
      tool_choice: { type: "function", function: { name: "submit_triage" } },
    }),
  });

  if (resp.status === 429) throw new Error("rate_limited");
  if (resp.status === 402) throw new Error("payment_required");
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ai_gateway_error_${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("ai_no_tool_call");

  const parsed = JSON.parse(call.function.arguments);
  // Saneamento defensivo
  const allowed = new Set(["low", "medium", "high", "critical"]);
  if (!allowed.has(parsed.severity_ai)) parsed.severity_ai = "medium";
  if (!Array.isArray(parsed.triage_tags)) parsed.triage_tags = [];
  parsed.triage_tags = parsed.triage_tags
    .filter((t: unknown) => typeof t === "string")
    .map((t: string) =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40),
    )
    .filter(Boolean)
    .slice(0, 8);
  parsed.area_ai = String(parsed.area_ai || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, 40) || "unknown";
  parsed.triage_summary = String(parsed.triage_summary || "").slice(0, 500);
  return parsed as {
    severity_ai: "low" | "medium" | "high" | "critical";
    area_ai: string;
    triage_summary: string;
    triage_tags: string[];
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!LOVABLE_API_KEY) return json({ error: "missing_lovable_api_key" }, 500);

  let body: { bug_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const bugId = body?.bug_id;
  if (!bugId || typeof bugId !== "string") {
    return json({ error: "missing_bug_id" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: bug, error: bugErr } = await admin
    .from("bug_reports")
    .select(
      "id,title,description,steps_to_reproduce,expected_behavior,actual_behavior,severity,route,user_role,device_type,os_name,browser_name,console_errors",
    )
    .eq("id", bugId)
    .maybeSingle();

  if (bugErr) return json({ error: "fetch_failed", detail: bugErr.message }, 500);
  if (!bug) return json({ error: "bug_not_found" }, 404);

  let triage;
  try {
    triage = await callTriage(bug as BugRow);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status =
      msg === "rate_limited" ? 429 : msg === "payment_required" ? 402 : 500;
    return json({ error: msg }, status);
  }

  // Detecção de duplicata: títulos similares (pg_trgm) entre bugs abertos recentes,
  // exceto este. Usa similaridade >= 0.5.
  let duplicateOf: string | null = null;
  const { data: dupRows } = await admin
    .rpc("execute_sql_safe_dedup_search", { p_id: bugId, p_title: bug.title })
    .maybeSingle()
    .then((r) => r)
    .catch(() => ({ data: null }));

  if (dupRows && typeof dupRows === "object" && "duplicate_of" in dupRows) {
    duplicateOf = (dupRows as { duplicate_of: string | null }).duplicate_of;
  } else {
    // Fallback: query direta via PostgREST com filtro ilike (sem pg_trgm)
    const { data: candidates } = await admin
      .from("bug_reports")
      .select("id,title")
      .neq("id", bugId)
      .neq("status", "resolved")
      .ilike("title", `%${bug.title.split(/\s+/).slice(0, 3).join(" ")}%`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (candidates && candidates.length > 0) duplicateOf = candidates[0].id;
  }

  const { error: updErr } = await admin
    .from("bug_reports")
    .update({
      severity_ai: triage.severity_ai,
      area_ai: triage.area_ai,
      triage_summary: triage.triage_summary,
      triage_tags: triage.triage_tags,
      duplicate_of: duplicateOf,
      triaged_at: new Date().toISOString(),
    })
    .eq("id", bugId);

  if (updErr) return json({ error: "update_failed", detail: updErr.message }, 500);

  return json({
    ok: true,
    triage: { ...triage, duplicate_of: duplicateOf },
  });
});
