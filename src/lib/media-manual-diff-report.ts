/**
 * Relatório de diffs (antes/depois) para orçamentos com upload manual.
 *
 * Compara o snapshot original armazenado em `media_integrity_baseline`
 * com o `media_config` atual de cada orçamento e produz, por orçamento:
 *   - quais campos mudaram (video3d, projeto3d, projetoExecutivo, fotos)
 *   - URLs adicionadas/removidas em cada campo
 *   - quais storages (buckets) foram acessados, derivados das URLs públicas
 *
 * Puro de leitura: usa apenas SELECTs, sem modificar nada no banco.
 */
import { supabase } from "@/integrations/supabase/client";

type MediaConfigShape = {
  video3d?: string;
  projeto3d?: string[];
  projetoExecutivo?: string[];
  fotos?: string[];
};

type FieldKey = "video3d" | "projeto3d" | "projetoExecutivo" | "fotos";

export interface FieldDiff {
  field: FieldKey;
  beforeCount: number;
  afterCount: number;
  added: string[];
  removed: string[];
  unchanged: number;
}

export interface BudgetManualDiff {
  budgetId: string;
  publicId: string | null;
  label: string;
  hasChanges: boolean;
  baselineCapturedAt: string | null;
  baselineReason: string | null;
  fields: FieldDiff[];
  bucketsAccessed: string[]; // buckets do supabase storage envolvidos (antes ∪ depois)
}

export interface ManualDiffReport {
  generatedAt: string;
  totalManualBudgets: number;
  withBaseline: number;
  withoutBaseline: number;
  changedCount: number;
  unchangedCount: number;
  bucketsAccessed: string[]; // união de todos os buckets vistos
  budgets: BudgetManualDiff[];
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Identifica o bucket do Supabase Storage a partir de uma URL pública.
 * Padrão: .../storage/v1/object/public/<bucket>/<path>
 * Para URLs externas, retorna "external:<host>".
 */
export function detectBucket(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
  if (m) return m[1];
  try {
    const u = new URL(url);
    return `external:${u.hostname}`;
  } catch {
    return null;
  }
}

function diffField(field: FieldKey, before: unknown, after: unknown): FieldDiff {
  const beforeArr =
    field === "video3d"
      ? typeof before === "string" && before.length > 0
        ? [before]
        : []
      : asStringArray(before);
  const afterArr =
    field === "video3d"
      ? typeof after === "string" && after.length > 0
        ? [after]
        : []
      : asStringArray(after);

  const beforeSet = new Set(beforeArr);
  const afterSet = new Set(afterArr);
  const added = afterArr.filter((u) => !beforeSet.has(u));
  const removed = beforeArr.filter((u) => !afterSet.has(u));
  const unchanged = beforeArr.filter((u) => afterSet.has(u)).length;

  return {
    field,
    beforeCount: beforeArr.length,
    afterCount: afterArr.length,
    added,
    removed,
    unchanged,
  };
}

function isManual(mc: MediaConfigShape | null | undefined): boolean {
  if (!mc || typeof mc !== "object") return false;
  const hasVideo = typeof mc.video3d === "string" && mc.video3d.trim().length > 0;
  const hasFotos = Array.isArray(mc.fotos) && mc.fotos.length > 0;
  const hasExec =
    Array.isArray(mc.projetoExecutivo) && mc.projetoExecutivo.length > 0;
  const has3d = Array.isArray(mc.projeto3d) && mc.projeto3d.length > 0;
  return hasVideo || hasFotos || hasExec || has3d;
}

/**
 * Gera o relatório completo de diffs para todos os orçamentos manuais.
 */
export async function generateManualDiffReport(): Promise<ManualDiffReport> {
  // 1. Carrega orçamentos com media_config (limite alto p/ cobrir base atual)
  const { data: budgetsRaw, error: bErr } = await supabase
    .from("budgets")
    .select("id, public_id, project_name, client_name, media_config")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (bErr) throw bErr;

  const budgets = (budgetsRaw ?? []) as Array<{
    id: string;
    public_id: string | null;
    project_name: string | null;
    client_name: string | null;
    media_config: MediaConfigShape | null;
  }>;

  const manualBudgets = budgets.filter((b) => isManual(b.media_config));

  // 2. Carrega baselines apenas dos manuais (em lote)
  const ids = manualBudgets.map((b) => b.id);
  const baselineMap = new Map<
    string,
    { media_config: MediaConfigShape; created_at: string; reason: string | null }
  >();

  if (ids.length > 0) {
    const { data: baselines, error: blErr } = await supabase
      .from("media_integrity_baseline")
      .select("budget_id, media_config, created_at, reason")
      .in("budget_id", ids);
    if (blErr) throw blErr;
    for (const row of baselines ?? []) {
      baselineMap.set(row.budget_id, {
        media_config: (row.media_config as MediaConfigShape) ?? {},
        created_at: row.created_at as string,
        reason: (row.reason as string | null) ?? null,
      });
    }
  }

  // 3. Computa diff por orçamento
  const allBuckets = new Set<string>();
  let withBaseline = 0;
  let withoutBaseline = 0;
  let changedCount = 0;
  let unchangedCount = 0;

  const reports: BudgetManualDiff[] = manualBudgets.map((b) => {
    const baseline = baselineMap.get(b.id);
    const before = baseline?.media_config ?? {};
    const after = b.media_config ?? {};

    if (baseline) withBaseline++;
    else withoutBaseline++;

    const fields: FieldDiff[] = (
      ["video3d", "projeto3d", "projetoExecutivo", "fotos"] as FieldKey[]
    ).map((f) =>
      diffField(
        f,
        (before as Record<FieldKey, unknown>)[f],
        (after as Record<FieldKey, unknown>)[f]
      )
    );

    const hasChanges = fields.some(
      (f) => f.added.length > 0 || f.removed.length > 0
    );
    if (hasChanges) changedCount++;
    else unchangedCount++;

    // Buckets acessados = união de todas as URLs (antes + depois)
    const bucketSet = new Set<string>();
    for (const f of fields) {
      for (const u of [...f.added, ...f.removed]) {
        const bk = detectBucket(u);
        if (bk) {
          bucketSet.add(bk);
          allBuckets.add(bk);
        }
      }
      // Inclui buckets de URLs unchanged também (foram lidos para o diff)
      const beforeArr =
        f.field === "video3d"
          ? typeof (before as Record<string, unknown>)[f.field] === "string"
            ? [(before as Record<string, string>)[f.field]]
            : []
          : asStringArray((before as Record<string, unknown>)[f.field]);
      for (const u of beforeArr) {
        const bk = detectBucket(u);
        if (bk) {
          bucketSet.add(bk);
          allBuckets.add(bk);
        }
      }
    }

    return {
      budgetId: b.id,
      publicId: b.public_id,
      label: `${b.project_name ?? "—"} (${b.client_name ?? "—"})`.slice(0, 120),
      hasChanges,
      baselineCapturedAt: baseline?.created_at ?? null,
      baselineReason: baseline?.reason ?? null,
      fields,
      bucketsAccessed: Array.from(bucketSet).sort(),
    };
  });

  // Mostra primeiro os com mudanças, depois sem baseline, depois inalterados.
  reports.sort((a, b) => {
    const ra = a.hasChanges ? 0 : !a.baselineCapturedAt ? 1 : 2;
    const rb = b.hasChanges ? 0 : !b.baselineCapturedAt ? 1 : 2;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label);
  });

  return {
    generatedAt: new Date().toISOString(),
    totalManualBudgets: manualBudgets.length,
    withBaseline,
    withoutBaseline,
    changedCount,
    unchangedCount,
    bucketsAccessed: Array.from(allBuckets).sort(),
    budgets: reports,
  };
}

/**
 * Serializa o relatório como JSON formatado para download.
 */
export function reportToJsonBlob(report: ManualDiffReport): Blob {
  return new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
}
