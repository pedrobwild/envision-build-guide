// Refetch a single meeting by transcribe_id from Elephan.ia.
// Used by the "Sincronizar agora" button to refresh existing meetings
// or to manually link a transcribe_id to the current budget.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Participant {
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
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

// Timeout wrapper para chamadas externas ao Elephan
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ELEPHAN_API_KEY = Deno.env.get("ELEPHAN_API_KEY");
  const ELEPHAN_API_BASE_URL = Deno.env.get("ELEPHAN_API_BASE_URL");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ELEPHAN_API_KEY || !ELEPHAN_API_BASE_URL) {
    return new Response(JSON.stringify({ error: "Missing Elephan secrets" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { budget_id?: string; transcribe_id?: string; refresh_all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const baseUrl = ELEPHAN_API_BASE_URL.replace(/\/$/, "");

  // Build list of transcribe IDs to fetch
  const idsToFetch: string[] = [];

  if (body.transcribe_id) {
    idsToFetch.push(body.transcribe_id);
  } else if (body.budget_id) {
    // Refresh all meetings already linked to this budget
    const { data } = await supabase
      .from("budget_meetings")
      .select("external_id")
      .eq("budget_id", body.budget_id)
      .eq("provider", "elephan_ia")
      .not("external_id", "is", null);
    for (const r of data ?? []) {
      if (r.external_id) idsToFetch.push(r.external_id as string);
    }
  } else if (body.refresh_all) {
    const { data } = await supabase
      .from("budget_meetings")
      .select("external_id")
      .eq("provider", "elephan_ia")
      .not("external_id", "is", null)
      .limit(50);
    for (const r of data ?? []) {
      if (r.external_id) idsToFetch.push(r.external_id as string);
    }
  }

  if (idsToFetch.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        pulled: 0,
        matched: 0,
        unmatched: 0,
        hint:
          "Nenhuma reunião vinculada a este orçamento ainda. Reuniões chegam automaticamente via webhook do Elephan.ia quando ficam prontas.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let matched = 0;
  let pulled = 0;
  const errors: string[] = [];

  for (const id of idsToFetch) {
    try {
      const r = await fetch(`${baseUrl}/transcribes/${id}`, {
        headers: {
          Authorization: `Bearer ${ELEPHAN_API_KEY}`,
          Accept: "application/json",
        },
      });
      const text = await r.text();
      if (!r.ok) {
        errors.push(`${id}: HTTP ${r.status}`);
        continue;
      }
      pulled++;
      const detail = JSON.parse(text);
      const t = (detail.data ?? detail) as Record<string, unknown>;
      const participants = (Array.isArray(t.participants)
        ? t.participants
        : []) as Participant[];

      const row = {
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

      const { error } = await supabase
        .from("budget_meetings")
        .update(row)
        .eq("provider", "elephan_ia")
        .eq("external_id", id);
      if (error) errors.push(`${id} update: ${error.message}`);
      else matched++;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      pulled,
      matched,
      unmatched: pulled - matched,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
