/**
 * Inferência de tipo lógico (`ColumnKind`) e papel analítico (`ColumnRole`)
 * para datasets sem schema declarado.
 *
 * Heurística determinística e conservadora:
 *  - se ≥80% dos valores não-nulos forem números finitos → number/integer/currency
 *  - se ≥80% baterem ISO date / Date.parse → date/datetime
 *  - se ≥80% forem boolean → boolean
 *  - se distinct ≤ max(20, 5% de n) → categorical
 *  - se distinct = n e nome bater /id|key|uuid/ → identifier
 *  - default → string
 *
 * `inferRole` decide depois com base em kind + heurísticas de nome.
 */

import type { ColumnKind, ColumnRole, DatasetRow } from "@/components/ai-analysis/types";

export interface InferOptions {
  /** override por nome de coluna (caller já sabe o tipo). */
  overrides?: Record<string, { kind?: ColumnKind; role?: ColumnRole }>;
  /** se nome casa /currency|valor|preco|total|receita|cost|cust|brl|r\$/ → currency. */
  currencyHints?: RegExp;
  /** se nome casa /pct|percent|taxa|rate|share/ → percent. */
  percentHints?: RegExp;
}

const ID_RE = /(^|_)(id|uuid|key|guid)$|^id$/i;
const DATE_HINT_RE = /(^|_)(date|dt|at|created|updated|deleted|closed|generated|approved|received|due|expected|lost|won|publicado|fechado)/i;
const TIME_HINT_RE = /(^|_)(time|hour|minute|second)/i;
const CURRENCY_HINT_RE = /(currency|valor|preco|preço|price|total|revenue|receita|cost|custo|brl|r\$)/i;
const PERCENT_HINT_RE = /(pct|percent|taxa|rate|share)/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isBooleanish(v: unknown): boolean {
  if (typeof v === "boolean") return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "false" || s === "yes" || s === "no" || s === "sim" || s === "não" || s === "nao";
  }
  return false;
}

function isFiniteNumberish(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return false;
    return Number.isFinite(Number(s));
  }
  return false;
}

function isIntegerish(v: unknown): boolean {
  if (typeof v === "number") return Number.isInteger(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return false;
    const n = Number(s);
    return Number.isInteger(n);
  }
  return false;
}

function isDateish(v: unknown): { ok: boolean; hasTime: boolean } {
  if (v instanceof Date) return { ok: !Number.isNaN(v.getTime()), hasTime: true };
  if (typeof v !== "string") return { ok: false, hasTime: false };
  const s = v.trim();
  if (!ISO_DATE_RE.test(s)) {
    // Aceita parse de não-ISO conservadoramente (apenas se contém '-' ou '/' e tem dígitos)
    if (!/[-/]/.test(s) || !/\d/.test(s)) return { ok: false, hasTime: false };
    const t = Date.parse(s);
    return { ok: Number.isFinite(t), hasTime: /[T ]\d/.test(s) };
  }
  return { ok: true, hasTime: /[T ]\d/.test(s) };
}

function isNonNullish(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
}

export function inferColumnKind(
  columnName: string,
  values: readonly unknown[],
  opts: InferOptions = {},
): ColumnKind {
  const ov = opts.overrides?.[columnName]?.kind;
  if (ov) return ov;

  const nonNull = values.filter(isNonNullish);
  if (nonNull.length === 0) return "unknown";

  const sample = nonNull.length > 500 ? sampleEvenly(nonNull, 500) : nonNull;

  let nNum = 0;
  let nInt = 0;
  let nDate = 0;
  let nDateTime = 0;
  let nBool = 0;

  for (const v of sample) {
    if (isFiniteNumberish(v)) {
      nNum++;
      if (isIntegerish(v)) nInt++;
    }
    const d = isDateish(v);
    if (d.ok) {
      nDate++;
      if (d.hasTime) nDateTime++;
    }
    if (isBooleanish(v)) nBool++;
  }

  const total = sample.length;
  const ratio = (count: number) => count / total;

  if (ratio(nBool) >= 0.8) return "boolean";
  if (ratio(nNum) >= 0.8) {
    const currencyRe = opts.currencyHints ?? CURRENCY_HINT_RE;
    const percentRe = opts.percentHints ?? PERCENT_HINT_RE;
    if (currencyRe.test(columnName)) return "currency";
    if (percentRe.test(columnName)) return "percent";
    if (nInt / nNum >= 0.95) return "integer";
    return "number";
  }
  if (ratio(nDate) >= 0.8) return nDateTime / nDate >= 0.5 ? "datetime" : "date";

  if (ID_RE.test(columnName)) return "id";

  // Categorical: cardinalidade baixa.
  const distinct = new Set(nonNull.map((v) => String(v))).size;
  if (distinct <= Math.max(20, total * 0.05) && distinct > 1) return "categorical";
  if (distinct === 1) return "categorical";

  return "string";
}

export function inferColumnRole(
  columnName: string,
  kind: ColumnKind,
  opts: { distinctCount: number; rowCount: number; declared?: ColumnRole } = {
    distinctCount: 0,
    rowCount: 0,
  },
): ColumnRole {
  if (opts.declared) return opts.declared;
  if (kind === "id") return "identifier";
  if (kind === "date" || kind === "datetime") return "time";
  if (kind === "number" || kind === "integer" || kind === "currency" || kind === "percent") {
    if (opts.rowCount > 0 && opts.distinctCount === opts.rowCount && ID_RE.test(columnName)) {
      return "identifier";
    }
    if (DATE_HINT_RE.test(columnName) || TIME_HINT_RE.test(columnName)) return "time";
    return "metric";
  }
  if (kind === "categorical" || kind === "string" || kind === "boolean") return "dimension";
  return "unknown";
}

function sampleEvenly<T>(arr: readonly T[], k: number): T[] {
  if (arr.length <= k) return [...arr];
  const out: T[] = [];
  const step = arr.length / k;
  for (let i = 0; i < k; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

/**
 * Coerção segura de valor → number. Retorna null se não-finito.
 * Centraliza a conversão para que correlações/forecast/etc. usem a mesma regra.
 */
export function coerceNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Coerção para timestamp epoch ms. Retorna null se não parsear.
 */
export function coerceTimestamp(v: unknown): number | null {
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * Helper: extrai uma coluna do dataset como array.
 */
export function pluck(rows: readonly DatasetRow[], columnName: string): unknown[] {
  return rows.map((r) => r[columnName]);
}
