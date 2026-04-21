// Public webhook called by Elephan.ia when a transcription is ready.
// Elephan sends { id: "...", event: "transcription.completed" } (or similar).
//
// Matching strategy (in order):
//   1) Client e-mail (lead_email) — e-mails @bwild.com.br são IGNORADOS,
//      pois pertencem aos consultores que participaram da reunião.
//   2) Telefone do cliente (client_phone) — apenas como fallback.
//
// Depois fazemos upsert em budget_meetings (chave: provider + external_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-elephan-signature, x-webhook-secret",
};

interface Participant {
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

// Domínios internos da BWild — e-mails desses domínios não identificam o cliente,
// pois são dos consultores que participaram da reunião.
const INTERNAL_EMAIL_DOMAINS = ["bwild.com.br"];

function isInternalEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((d) => lower.endsWith(`@${d}`));
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

// Timeout wrapper para fetch externo (evita travar a function quando o
// upstream do Elephan demora demais).
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface MatchResult {
  budget_id: string;
  matched_by: "client_email" | "client_phone";
  matched_value: string;
}

async function findBudgetIdForMeeting(
  supabase: ReturnType<typeof createClient>,
  participants: Participant[]
): Promise<MatchResult | null> {
  // E-mails de CLIENTES apenas — exclui domínios internos (@bwild.com.br).
  // Este é o identificador principal de quem é o cliente da reunião.
  const clientEmails = [
    ...new Set(
      participants
        .map((p) => normalizeEmail(p?.email))
        .filter((e): e is string => !!e && !isInternalEmail(e)),
    ),
  ];

  const phones = [
    ...new Set(
      participants
        .map((p) => normalizePhone(p?.phone))
        .filter((p): p is string => !!p),
    ),
  ];

  console.log(
    `[elephan-webhook] Matching — client_emails=${JSON.stringify(clientEmails)} phones=${JSON.stringify(phones)}`,
  );

  // 1) IDENTIFICADOR PRINCIPAL: e-mail do cliente (lead_email).
  // Busca case-insensitive via lower() comparando com cada email normalizado.
  if (clientEmails.length > 0) {
    const { data, error } = await supabase
      .from("budgets")
      .select("id, lead_email, created_at")
      .in("lead_email", clientEmails)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) console.error("[elephan-webhook] email match error:", error.message);
    if (data && data.length > 0) {
      return {
        budget_id: data[0].id as string,
        matched_by: "client_email",
        matched_value: (data[0].lead_email as string) ?? "",
      };
    }

    // Tentativa secundária: comparar em lower() caso o lead_email salvo tenha caixa mista.
    // Como PostgREST não aceita lower() em .in(), fazemos uma busca por cada email em OR.
    const orEmailFilter = clientEmails
      .map((e) => `lead_email.ilike.${e}`)
      .join(",");
    const { data: fuzzy } = await supabase
      .from("budgets")
      .select("id, lead_email, created_at")
      .or(orEmailFilter)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fuzzy && fuzzy.length > 0) {
      return {
        budget_id: fuzzy[0].id as string,
        matched_by: "client_email",
        matched_value: (fuzzy[0].lead_email as string) ?? "",
      };
    }
  }

  // 2) FALLBACK: telefone (quando não há e-mail de cliente ou ele não bateu).
  if (phones.length > 0) {
    const orFilter = phones
      .flatMap((p) => [`client_phone.eq.${p}`, `client_phone.eq.55${p}`])
      .join(",");
    const { data } = await supabase
      .from("budgets")
      .select("id, client_phone, created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      return {
        budget_id: data[0].id as string,
        matched_by: "client_phone",
        matched_value: (data[0].client_phone as string) ?? "",
      };
    }
  }

  return null;
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ELEPHAN_API_KEY = Deno.env.get("ELEPHAN_API_KEY");
  const ELEPHAN_API_BASE_URL = Deno.env.get("ELEPHAN_API_BASE_URL");
  const WEBHOOK_SECRET = Deno.env.get("ELEPHAN_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ELEPHAN_API_KEY || !ELEPHAN_API_BASE_URL) {
    return new Response(JSON.stringify({ error: "Missing Elephan secrets" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Optional: verify a shared secret se ELEPHAN_WEBHOOK_SECRET estiver definido.
  // Aceitamos vários formatos que diferentes provedores usam:
  //   - x-webhook-secret: <secret>
  //   - x-elephan-signature: <secret>
  //   - x-api-key: <secret>
  //   - Authorization: Bearer <secret>
  //   - ?secret=<secret> ou ?token=<secret> na URL
  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const authHeader = req.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-elephan-signature") ??
      req.headers.get("x-api-key") ??
      bearer ??
      url.searchParams.get("secret") ??
      url.searchParams.get("token") ??
      "";

    if (provided !== WEBHOOK_SECRET) {
      // Log detalhado dos headers recebidos (sem vazar o valor do secret).
      const headerNames: string[] = [];
      req.headers.forEach((_, k) => headerNames.push(k));
      console.warn(
        `[elephan-webhook] Invalid webhook secret — received_headers=${JSON.stringify(headerNames)} provided_length=${provided.length} expected_length=${WEBHOOK_SECRET.length} query_keys=${JSON.stringify([...url.searchParams.keys()])}`,
      );
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          hint:
            "Webhook secret ausente ou incorreto. O Elephan deve enviar o secret em um destes headers: x-webhook-secret, x-elephan-signature, x-api-key, Authorization: Bearer <secret>, ou via query ?secret=<secret>. Para desativar a validação, remova ELEPHAN_WEBHOOK_SECRET dos secrets da edge function.",
          received_headers: headerNames,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[elephan-webhook] Received:", JSON.stringify(body).slice(0, 500));

  // Try to extract transcription ID from common payload shapes
  const transcribeId =
    pickString(body, ["id", "transcribe_id", "transcription_id"]) ??
    pickString((body.data ?? {}) as Record<string, unknown>, ["id", "transcribe_id"]);

  if (!transcribeId) {
    return new Response(
      JSON.stringify({ error: "No transcription id found in payload", received: body }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch full details
  const baseUrl = ELEPHAN_API_BASE_URL.replace(/\/$/, "");
  const detailUrl = `${baseUrl}/transcribes/${transcribeId}`;

  let detail: Record<string, unknown>;
  try {
    const r = await fetchWithTimeout(detailUrl, {
      headers: {
        Authorization: `Bearer ${ELEPHAN_API_KEY}`,
        Accept: "application/json",
      },
    });
    const text = await r.text();
    if (!r.ok) {
      console.error(`[elephan-webhook] Detail fetch failed [${r.status}]:`, text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Elephan API ${r.status}: ${text.slice(0, 500)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    detail = JSON.parse(text);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Unwrap if response is { data: {...} }
  const t = (detail.data ?? detail) as Record<string, unknown>;

  const participants = (Array.isArray(t.participants) ? t.participants : []) as Participant[];

  const match = await findBudgetIdForMeeting(supabase, participants);
  if (!match) {
    console.warn(
      `[elephan-webhook] No matching budget for transcribe ${transcribeId} (participants=${participants.length})`,
    );
    return new Response(
      JSON.stringify({
        success: false,
        reason: "no_matching_budget",
        transcribe_id: transcribeId,
        participants_count: participants.length,
        hint:
          "Nenhum participante da reunião bateu com lead_email ou client_phone de um orçamento. E-mails @bwild.com.br são ignorados (são dos consultores).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(
    `[elephan-webhook] Matched transcribe ${transcribeId} → budget ${match.budget_id} via ${match.matched_by}=${match.matched_value}`,
  );

  const row = {
    budget_id: match.budget_id,
    provider: "elephan_ia",
    external_id: String(transcribeId),
    title: pickString(t, ["title", "name", "subject"]),
    started_at:
      pickString(t, ["started_at", "start_time", "created_at", "date"]) ?? null,
    duration_seconds: pickNumber(t, ["duration_seconds", "duration", "length"]),
    participants: participants as unknown,
    transcript: pickString(t, ["transcript", "transcription", "text"]),
    summary: pickString(t, ["summary", "executive_summary", "overview"]),
    video_url: pickString(t, ["video_url", "video", "recording_url"]),
    audio_url: pickString(t, ["audio_url", "audio"]),
    action_items: pickArray(t, ["action_items", "actions", "tasks"]) as unknown,
    questions: pickArray(t, ["questions", "doubts", "client_questions"]) as unknown,
    objections: pickArray(t, ["objections", "concerns"]) as unknown,
    next_steps: pickArray(t, ["next_steps", "follow_up", "next_actions"]) as unknown,
    full_report: t,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("budget_meetings")
    .select("id")
    .eq("provider", "elephan_ia")
    .eq("external_id", String(transcribeId))
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("budget_meetings")
      .update(row)
      .eq("id", existing.id);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    const { error } = await supabase.from("budget_meetings").insert(row);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      transcribe_id: transcribeId,
      budget_id: match.budget_id,
      matched_by: match.matched_by,
      matched_value: match.matched_value,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
