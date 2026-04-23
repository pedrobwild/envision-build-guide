// Verificação periódica de integridade de mídia.
// Compara o media_config atual de cada orçamento marcado como "manual" (presente
// em media_integrity_baseline) com o snapshot armazenado. Quando detecta:
//   - hash diferente  → alerta config_changed
//   - contagens divergentes → alerta count_mismatch
//   - URL HEAD falhando → alerta url_broken
// grava em media_integrity_alerts (status='open') sem duplicar alertas abertos
// recentes do mesmo tipo.
//
// Acionado por cron diário (ver migration que agenda) ou manualmente via
// supabase.functions.invoke('media-integrity-check').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MediaConfig {
  video3d?: string;
  projeto3d?: string[];
  projetoExecutivo?: string[];
  fotos?: string[];
}

interface BaselineRow {
  budget_id: string;
  media_config: MediaConfig;
  config_hash: string;
  video3d_count: number;
  projeto3d_count: number;
  projeto_executivo_count: number;
  fotos_count: number;
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function countCategories(mc: MediaConfig | null | undefined) {
  return {
    video3d_count: mc?.video3d && mc.video3d.length > 0 ? 1 : 0,
    projeto3d_count: Array.isArray(mc?.projeto3d) ? mc!.projeto3d!.length : 0,
    projeto_executivo_count: Array.isArray(mc?.projetoExecutivo)
      ? mc!.projetoExecutivo!.length
      : 0,
    fotos_count: Array.isArray(mc?.fotos) ? mc!.fotos!.length : 0,
  };
}

async function checkUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

function collectUrls(mc: MediaConfig): string[] {
  const out: string[] = [];
  if (mc.video3d) out.push(mc.video3d);
  for (const u of mc.projeto3d ?? []) out.push(u);
  for (const u of mc.projetoExecutivo ?? []) out.push(u);
  for (const u of mc.fotos ?? []) out.push(u);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Permite limitar verificação de URLs (HEAD é caro). Padrão: amostra 5 por orçamento.
  const body = await req.json().catch(() => ({}));
  const checkUrls: boolean = body?.check_urls ?? true;
  const urlSampleSize: number = body?.url_sample_size ?? 5;

  const summary = {
    checked: 0,
    alerts_created: 0,
    by_type: {
      config_changed: 0,
      count_mismatch: 0,
      url_broken: 0,
    } as Record<string, number>,
    errors: [] as string[],
  };

  // 1. Carrega todos os baselines
  const { data: baselines, error: blErr } = await supabase
    .from("media_integrity_baseline")
    .select(
      "budget_id, media_config, config_hash, video3d_count, projeto3d_count, projeto_executivo_count, fotos_count"
    );

  if (blErr) {
    return new Response(
      JSON.stringify({ error: "Falha ao ler baselines", details: blErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!baselines || baselines.length === 0) {
    return new Response(
      JSON.stringify({ message: "Nenhum baseline registrado.", summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Carrega os media_config atuais em lote
  const ids = baselines.map((b) => b.budget_id);
  const { data: budgets } = await supabase
    .from("budgets")
    .select("id, project_name, client_name, media_config")
    .in("id", ids);

  const budgetMap = new Map(budgets?.map((b) => [b.id, b]) ?? []);

  // 3. Para cada baseline, compara
  for (const bl of baselines as BaselineRow[]) {
    summary.checked++;
    const budget = budgetMap.get(bl.budget_id);
    if (!budget) continue;

    const label =
      `${budget.project_name ?? "—"} (${budget.client_name ?? "—"})`.slice(0, 200);
    const currentMc = (budget.media_config as MediaConfig | null) ?? {};
    const currentHash = await sha256(JSON.stringify(currentMc));
    const counts = countCategories(currentMc);

    const alertsToCreate: Array<{
      alert_type: string;
      severity: string;
      details: Record<string, unknown>;
    }> = [];

    // Hash diferente → houve QUALQUER mudança
    if (currentHash !== bl.config_hash) {
      alertsToCreate.push({
        alert_type: "config_changed",
        severity: "warning",
        details: {
          baseline_hash: bl.config_hash,
          current_hash: currentHash,
        },
      });
    }

    // Diferenças de contagem por categoria (mais granular)
    const countDiffs: Record<string, { baseline: number; current: number }> = {};
    if (counts.video3d_count !== bl.video3d_count)
      countDiffs.video3d = { baseline: bl.video3d_count, current: counts.video3d_count };
    if (counts.projeto3d_count !== bl.projeto3d_count)
      countDiffs.projeto3d = {
        baseline: bl.projeto3d_count,
        current: counts.projeto3d_count,
      };
    if (counts.projeto_executivo_count !== bl.projeto_executivo_count)
      countDiffs.projetoExecutivo = {
        baseline: bl.projeto_executivo_count,
        current: counts.projeto_executivo_count,
      };
    if (counts.fotos_count !== bl.fotos_count)
      countDiffs.fotos = { baseline: bl.fotos_count, current: counts.fotos_count };

    if (Object.keys(countDiffs).length > 0) {
      alertsToCreate.push({
        alert_type: "count_mismatch",
        severity: Object.keys(countDiffs).some(
          (k) => countDiffs[k].current < countDiffs[k].baseline
        )
          ? "critical" // perda de mídia = crítico
          : "warning",
        details: { differences: countDiffs },
      });
    }

    // Validação de URLs (amostragem)
    if (checkUrls) {
      const urls = collectUrls(currentMc);
      const sample = urls.slice(0, urlSampleSize);
      const broken: string[] = [];
      for (const u of sample) {
        const ok = await checkUrl(u);
        if (!ok) broken.push(u);
      }
      if (broken.length > 0) {
        alertsToCreate.push({
          alert_type: "url_broken",
          severity: "critical",
          details: { broken_urls: broken, sample_size: sample.length },
        });
      }
    }

    // Evita duplicar alertas abertos do mesmo tipo (criados nas últimas 24h)
    if (alertsToCreate.length > 0) {
      const types = alertsToCreate.map((a) => a.alert_type);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("media_integrity_alerts")
        .select("alert_type")
        .eq("budget_id", bl.budget_id)
        .eq("status", "open")
        .gte("created_at", cutoff)
        .in("alert_type", types);

      const existingTypes = new Set(existing?.map((e) => e.alert_type) ?? []);
      const fresh = alertsToCreate.filter((a) => !existingTypes.has(a.alert_type));

      if (fresh.length > 0) {
        const rows = fresh.map((a) => ({
          budget_id: bl.budget_id,
          budget_label: label,
          alert_type: a.alert_type,
          severity: a.severity,
          details: a.details,
          baseline_snapshot: bl.media_config,
          current_snapshot: currentMc,
        }));
        const { error: insErr } = await supabase
          .from("media_integrity_alerts")
          .insert(rows);
        if (insErr) {
          summary.errors.push(`${bl.budget_id}: ${insErr.message}`);
        } else {
          summary.alerts_created += fresh.length;
          for (const a of fresh) {
            summary.by_type[a.alert_type] = (summary.by_type[a.alert_type] ?? 0) + 1;
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
