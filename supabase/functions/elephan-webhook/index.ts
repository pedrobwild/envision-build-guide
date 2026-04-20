// Public webhook called by Elephan.ia when a transcription is ready.
// Elephan sends { id: "...", event: "transcription.completed" } (or similar).
// We then fetch GET /v1/transcribes/{id}, match the budget by phone/email,
// and upsert into budget_meetings.

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

async function findBudgetIdForMeeting(
  supabase: ReturnType<typeof createClient>,
  participants: Participant[]
): Promise<string | null> {
  const phones = [
    ...new Set(
      participants
        .map((p) => normalizePhone(p?.phone))
        .filter((p): p is string => !!p),
    ),
  ];
  const emails = [
    ...new Set(
      participants
        .map((p) => p?.email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
    ),
  ];

  // 1) Busca todos os phones em UMA query (substitui N+1)
  if (phones.length > 0) {
    const orFilter = phones
      .flatMap((p) => [`client_phone.eq.${p}`, `client_phone.eq.55${p}`])
      .join(",");
    const { data } = await supabase
      .from("budgets")
      .select("id,created_at")
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }

  // 2) Busca todos os emails em UMA query
  if (emails.length > 0) {
    const { data } = await supabase
      .from("budgets")
      .select("id,created_at")
      .in("lead_email", emails)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
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

  // Optional: verify a shared secret if Elephan supports it
  if (WEBHOOK_SECRET) {
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("x-elephan-signature") ??
      "";
    if (provided !== WEBHOOK_SECRET) {
      console.warn("[elephan-webhook] Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const r = await fetch(detailUrl, {
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

  const budgetId = await findBudgetIdForMeeting(supabase, participants);
  if (!budgetId) {
    console.warn("[elephan-webhook] No matching budget for transcribe", transcribeId);
    return new Response(
      JSON.stringify({
        success: false,
        reason: "no_matching_budget",
        transcribe_id: transcribeId,
        participants_count: participants.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const row = {
    budget_id: budgetId,
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
      budget_id: budgetId,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
