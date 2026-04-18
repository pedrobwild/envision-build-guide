// Pulls meetings from Elephan.ia API and upserts them into budget_meetings.
// Matches each meeting to a budget by client_phone or lead_email.
// Designed to be called manually (button) or by pg_cron hourly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ElephanParticipant {
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
}

interface ElephanMeeting {
  id: string;
  title?: string;
  started_at?: string;
  duration_seconds?: number;
  participants?: ElephanParticipant[];
  transcript?: string;
  summary?: string;
  video_url?: string;
  audio_url?: string;
  action_items?: unknown[];
  questions?: unknown[];
  objections?: unknown[];
  next_steps?: unknown[];
  report?: Record<string, unknown>;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

async function findBudgetIdForMeeting(
  supabase: ReturnType<typeof createClient>,
  participants: ElephanParticipant[]
): Promise<string | null> {
  const phones = participants
    .map((p) => normalizePhone(p.phone))
    .filter((p): p is string => !!p);
  const emails = participants
    .map((p) => p.email?.trim().toLowerCase())
    .filter((e): e is string => !!e);

  // Try phone match first (most reliable for BR)
  for (const phone of phones) {
    const { data } = await supabase
      .from("budgets")
      .select("id, client_phone, lead_email")
      .or(`client_phone.eq.${phone},client_phone.eq.55${phone}`)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }

  // Fallback to email match
  for (const email of emails) {
    const { data } = await supabase
      .from("budgets")
      .select("id")
      .eq("lead_email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id as string;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ELEPHAN_API_KEY = Deno.env.get("ELEPHAN_API_KEY");
  const ELEPHAN_API_BASE_URL = Deno.env.get("ELEPHAN_API_BASE_URL");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ELEPHAN_API_KEY || !ELEPHAN_API_BASE_URL) {
    return new Response(
      JSON.stringify({ error: "Missing ELEPHAN_API_KEY or ELEPHAN_API_BASE_URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Optional budget_id in body — when present we only match meetings to this budget
  let scopedBudgetId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.budget_id && typeof body.budget_id === "string") {
        scopedBudgetId = body.budget_id;
      }
    }
  } catch {
    // ignore
  }

  // Read last synced timestamp to limit window
  const { data: stateRow } = await supabase
    .from("elephan_sync_state")
    .select("last_synced_at")
    .order("last_run_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const since = stateRow?.last_synced_at
    ? new Date(stateRow.last_synced_at as string)
    : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // 30 days back on first run

  // Build URL — try a sensible REST default. Adjust here once we know the real shape.
  const baseUrl = ELEPHAN_API_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}/meetings?since=${encodeURIComponent(since.toISOString())}&limit=100`;

  console.log(`[elephan-sync] Fetching ${url}`);

  let meetings: ElephanMeeting[] = [];
  let rawSample: unknown = null;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ELEPHAN_API_KEY}`,
        Accept: "application/json",
      },
    });

    const text = await resp.text();
    console.log(`[elephan-sync] Status: ${resp.status}, body preview:`, text.slice(0, 500));

    if (!resp.ok) {
      errorMessage = `HTTP ${resp.status}: ${text.slice(0, 1000)}`;
      throw new Error(errorMessage);
    }

    const json = JSON.parse(text);
    rawSample = Array.isArray(json) ? json[0] : json?.data?.[0] ?? json?.meetings?.[0] ?? json;

    // Try common shapes: array root, {data: []}, {meetings: []}, {results: []}
    if (Array.isArray(json)) meetings = json;
    else if (Array.isArray(json?.data)) meetings = json.data;
    else if (Array.isArray(json?.meetings)) meetings = json.meetings;
    else if (Array.isArray(json?.results)) meetings = json.results;
    else {
      console.warn("[elephan-sync] Unknown response shape, full body:", text.slice(0, 2000));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[elephan-sync] Fetch failed:", msg);
    errorMessage = errorMessage ?? msg;

    await supabase.from("elephan_sync_state").insert({
      last_run_at: new Date().toISOString(),
      meetings_pulled: 0,
      meetings_matched: 0,
      meetings_unmatched: 0,
      error_message: errorMessage,
      raw_sample: null,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        hint:
          "Confira ELEPHAN_API_BASE_URL e ELEPHAN_API_KEY. O esperado é GET {BASE}/meetings?since=ISO retornando JSON array (ou {data:[]}, {meetings:[]}, {results:[]}).",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let matched = 0;
  let unmatched = 0;
  const upsertErrors: string[] = [];

  for (const m of meetings) {
    if (!m?.id) continue;
    const participants = Array.isArray(m.participants) ? m.participants : [];

    let budgetId = scopedBudgetId;
    if (!budgetId) {
      budgetId = await findBudgetIdForMeeting(supabase, participants);
    }
    if (!budgetId) {
      unmatched++;
      continue;
    }

    const row = {
      budget_id: budgetId,
      provider: "elephan_ia",
      external_id: String(m.id),
      title: m.title ?? null,
      started_at: m.started_at ?? null,
      duration_seconds: m.duration_seconds ?? null,
      participants: participants as unknown,
      transcript: m.transcript ?? null,
      summary: m.summary ?? null,
      video_url: m.video_url ?? null,
      audio_url: m.audio_url ?? null,
      action_items: (m.action_items ?? []) as unknown,
      questions: (m.questions ?? []) as unknown,
      objections: (m.objections ?? []) as unknown,
      next_steps: (m.next_steps ?? []) as unknown,
      full_report: m.report ?? null,
      updated_at: new Date().toISOString(),
    };

    // Upsert by (provider, external_id) — manual since we lack a unique constraint
    const { data: existing } = await supabase
      .from("budget_meetings")
      .select("id")
      .eq("provider", "elephan_ia")
      .eq("external_id", String(m.id))
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("budget_meetings")
        .update(row)
        .eq("id", existing.id);
      if (error) upsertErrors.push(`update ${m.id}: ${error.message}`);
      else matched++;
    } else {
      const { error } = await supabase.from("budget_meetings").insert(row);
      if (error) upsertErrors.push(`insert ${m.id}: ${error.message}`);
      else matched++;
    }
  }

  await supabase.from("elephan_sync_state").insert({
    last_synced_at: new Date().toISOString(),
    last_run_at: new Date().toISOString(),
    meetings_pulled: meetings.length,
    meetings_matched: matched,
    meetings_unmatched: unmatched,
    error_message: upsertErrors.length > 0 ? upsertErrors.join(" | ").slice(0, 2000) : null,
    raw_sample: rawSample as never,
  });

  return new Response(
    JSON.stringify({
      success: true,
      pulled: meetings.length,
      matched,
      unmatched,
      errors: upsertErrors,
      raw_sample: rawSample,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
