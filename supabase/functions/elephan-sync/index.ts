// Sincroniza reuniões do Elephan.ia com um orçamento.
//
// Fluxo:
//   1) Se body.transcribe_id for informado: refetch + vincular esse ID ao budget_id.
//   2) Se body.budget_id for informado:
//      a) Atualiza reuniões já vinculadas (refetch dos transcribe_ids salvos).
//      b) Busca na API da Elephan reuniões pelo lead_email e client_phone do
//         orçamento e faz upsert (vincula novas reuniões que ainda não chegaram
//         via webhook).
//   3) Se body.refresh_all: refetch das últimas 50 reuniões já cadastradas.

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

const INTERNAL_EMAIL_DOMAINS = ["bwild.com.br"];

function isInternalEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((d) => lower.endsWith(`@${d}`));
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
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

/**
 * Lista reuniões na API do Elephan tentando vários parâmetros de filtro
 * (a API aceita combinações de search/email/phone/q em diferentes versões).
 * Retorna array de IDs únicos que potencialmente pertencem ao cliente.
 */
async function searchTranscribeIds(
  baseUrl: string,
  apiKey: string,
  params: { email?: string | null; phone?: string | null },
): Promise<{ ids: string[]; rawHits: number; tried: string[] }> {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  const found = new Set<string>();
  let rawHits = 0;
  const tried: string[] = [];

  const queries: string[] = [];
  if (params.email) {
    queries.push(`?search=${encodeURIComponent(params.email)}`);
    queries.push(`?q=${encodeURIComponent(params.email)}`);
    queries.push(`?email=${encodeURIComponent(params.email)}`);
    queries.push(`?participant_email=${encodeURIComponent(params.email)}`);
  }
  if (params.phone) {
    queries.push(`?search=${encodeURIComponent(params.phone)}`);
    queries.push(`?q=${encodeURIComponent(params.phone)}`);
    queries.push(`?phone=${encodeURIComponent(params.phone)}`);
    queries.push(`?participant_phone=${encodeURIComponent(params.phone)}`);
  }

  for (const qs of queries) {
    const url = `${baseUrl}/transcribes${qs}&per_page=50&limit=50`;
    tried.push(url);
    try {
      const r = await fetchWithTimeout(url, { headers });
      const text = await r.text();
      if (!r.ok) {
        console.warn(`[elephan-sync] search ${qs} -> HTTP ${r.status}`);
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }
      const list =
        (Array.isArray(json) ? json : null) ??
        (json as Record<string, unknown>)?.data ??
        (json as Record<string, unknown>)?.results ??
        (json as Record<string, unknown>)?.transcribes ??
        [];
      if (!Array.isArray(list)) continue;
      rawHits += list.length;
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const id =
          (item as Record<string, unknown>).id ??
          (item as Record<string, unknown>).transcribe_id ??
          (item as Record<string, unknown>).uuid;
        if (typeof id === "string" && id.length > 0) found.add(id);
      }
    } catch (e) {
      console.warn(
        `[elephan-sync] search error ${qs}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { ids: [...found], rawHits, tried };
}

/**
 * Busca o detalhe de uma reunião e faz upsert em budget_meetings vinculando ao budget_id.
 * Se onlyIfMatchesClient=true, só cria/atualiza se algum participante bater com email/phone do cliente.
 */
async function upsertMeetingForBudget(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  baseUrl: string,
  apiKey: string,
  budget_id: string,
  transcribe_id: string,
  client: { email: string | null; phone: string | null } | null,
): Promise<{ ok: boolean; matched: boolean; reason?: string }> {
  const r = await fetchWithTimeout(`${baseUrl}/transcribes/${transcribe_id}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, matched: false, reason: `HTTP ${r.status}` };
  let detail: Record<string, unknown>;
  try {
    detail = JSON.parse(text);
  } catch {
    return { ok: false, matched: false, reason: "invalid_json" };
  }
  const t = (detail.data ?? detail) as Record<string, unknown>;
  const participants = (Array.isArray(t.participants) ? t.participants : []) as Participant[];

  // Se temos contato do cliente, validamos se algum participante bate.
  let matched = true;
  if (client && (client.email || client.phone)) {
    matched = false;
    for (const p of participants) {
      const pe = normalizeEmail(p?.email);
      const pp = normalizePhone(p?.phone);
      if (pe && client.email && pe === client.email && !isInternalEmail(pe)) {
        matched = true;
        break;
      }
      if (pp && client.phone && pp === client.phone) {
        matched = true;
        break;
      }
    }
    if (!matched) return { ok: true, matched: false, reason: "no_participant_match" };
  }

  const row = {
    budget_id,
    provider: "elephan_ia",
    external_id: transcribe_id,
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

  // Upsert por (provider, external_id)
  const { error } = await supabase
    .from("budget_meetings")
    .upsert(row, { onConflict: "provider,external_id" });
  if (error) return { ok: false, matched: true, reason: error.message };
  return { ok: true, matched: true };
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

  // Carrega contato do cliente (email/phone) quando temos budget_id
  let client: { email: string | null; phone: string | null } | null = null;
  if (body.budget_id) {
    const { data: budget } = await supabase
      .from("budgets")
      .select("lead_email, client_phone")
      .eq("id", body.budget_id)
      .maybeSingle();
    if (budget) {
      client = {
        email: normalizeEmail(budget.lead_email as string | null),
        phone: normalizePhone(budget.client_phone as string | null),
      };
    }
  }

  // Lista de transcribe IDs a processar
  const idsToFetch = new Set<string>();

  if (body.transcribe_id) {
    idsToFetch.add(body.transcribe_id);
  }

  if (body.budget_id) {
    // (a) IDs já vinculados (refresh)
    const { data: existing } = await supabase
      .from("budget_meetings")
      .select("external_id")
      .eq("budget_id", body.budget_id)
      .eq("provider", "elephan_ia")
      .not("external_id", "is", null);
    for (const r of existing ?? []) {
      if (r.external_id) idsToFetch.add(r.external_id as string);
    }

    // (b) Busca na API da Elephan por email/phone do cliente
    if (client && (client.email || client.phone)) {
      const searched = await searchTranscribeIds(baseUrl, ELEPHAN_API_KEY, client);
      console.log(
        `[elephan-sync] searched email=${client.email} phone=${client.phone} -> ${searched.ids.length} ids (rawHits=${searched.rawHits})`,
      );
      for (const id of searched.ids) idsToFetch.add(id);
    }
  } else if (body.refresh_all) {
    const { data } = await supabase
      .from("budget_meetings")
      .select("external_id")
      .eq("provider", "elephan_ia")
      .not("external_id", "is", null)
      .limit(50);
    for (const r of data ?? []) {
      if (r.external_id) idsToFetch.add(r.external_id as string);
    }
  }

  if (idsToFetch.size === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        pulled: 0,
        matched: 0,
        unmatched: 0,
        client_email: client?.email ?? null,
        client_phone: client?.phone ?? null,
        hint: client && (client.email || client.phone)
          ? "Nenhuma reunião encontrada na Elephan.ia para o e-mail/telefone deste cliente. Verifique se o cliente realmente participou da reunião com este contato cadastrado."
          : "Cadastre e-mail e/ou telefone do cliente no orçamento para que possamos buscar reuniões dele na Elephan.ia.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let matched = 0;
  let pulled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const id of idsToFetch) {
    if (!body.budget_id) {
      // refresh_all path: usa update existente sem revalidar cliente
      try {
        const r = await fetchWithTimeout(`${baseUrl}/transcribes/${id}`, {
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
        const participants = (Array.isArray(t.participants) ? t.participants : []) as Participant[];
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
      continue;
    }

    // budget_id path: upsert validando cliente
    try {
      const res = await upsertMeetingForBudget(
        supabase,
        baseUrl,
        ELEPHAN_API_KEY,
        body.budget_id,
        id,
        client,
      );
      pulled++;
      if (res.ok && res.matched) matched++;
      else if (res.ok && !res.matched) skipped++;
      else if (!res.ok) errors.push(`${id}: ${res.reason ?? "unknown"}`);
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      pulled,
      matched,
      skipped,
      unmatched: pulled - matched - skipped,
      client_email: client?.email ?? null,
      client_phone: client?.phone ?? null,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
