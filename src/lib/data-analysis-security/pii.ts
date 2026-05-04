/**
 * Detecção e mascaramento de PII em datasets / strings.
 *
 * Não substitui revisão jurídica/LGPD. É uma camada de defesa em
 * profundidade aplicada ANTES de enviar dados ao gateway de IA.
 *
 * Cobertura:
 *  - email
 *  - telefone BR (com DDD)
 *  - CPF (com ou sem máscara)
 *  - CNPJ (com ou sem máscara)
 *  - cartão de crédito (Luhn não-validado, só formato)
 *
 * Política default: mascarar (substituir por "[REDACTED:tipo]").
 */

import type { Dataset, DatasetRow } from "@/components/ai-analysis/types";

export type PiiKind = "email" | "phone_br" | "cpf" | "cnpj" | "credit_card";

export interface PiiMatch {
  kind: PiiKind;
  /** índice de início no texto. */
  start: number;
  /** índice de fim (exclusivo). */
  end: number;
  /** valor original. */
  match: string;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Telefone BR: exige separador ou prefixo +55. Para plain digits (sem
// separador), ambiguidade com CPF é resolvida favorecendo CPF.
const PHONE_BR_RE =
  /\+55\s?\d{10,11}|\+55[\s-]?\(?\d{2}\)?[\s-]?9?\d{4}[-\s]\d{4}|\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}|\b\d{2}\s9?\d{4}[-\s]\d{4}\b/g;
const CPF_RE = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;
const CNPJ_RE = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g;
const CREDIT_CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;

// Ordem importa: matches que coincidem em posição são desempatados pela
// ordem aqui (mais específico primeiro). CNPJ antes de CPF antes de phone.
const MATCHERS: Array<{ kind: PiiKind; re: RegExp; minLength?: number }> = [
  { kind: "email", re: EMAIL_RE },
  { kind: "cnpj", re: CNPJ_RE, minLength: 14 },
  { kind: "cpf", re: CPF_RE, minLength: 11 },
  { kind: "phone_br", re: PHONE_BR_RE, minLength: 10 },
  { kind: "credit_card", re: CREDIT_CARD_RE, minLength: 13 },
];

/**
 * Lista todas as ocorrências de PII em um texto.
 * Não dedupa nem valida com Luhn — caller decide.
 */
export function findPii(text: string): PiiMatch[] {
  if (!text) return [];
  const matches: Array<PiiMatch & { priority: number }> = [];
  MATCHERS.forEach(({ kind, re, minLength }, priority) => {
    const regex = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const v = m[0];
      const cleaned = v.replace(/\D/g, "");
      if (minLength && cleaned.length < minLength) continue;
      matches.push({ kind, start: m.index, end: m.index + v.length, match: v, priority });
    }
  });
  // ordena por start; em empate, maior cobertura (end maior) e menor priority
  // (= mais específico) primeiro.
  matches.sort((a, b) => a.start - b.start || b.end - a.end || a.priority - b.priority);
  return matches.map(({ priority: _p, ...rest }) => rest);
}

/**
 * Substitui PIIs por marcador. Default: "[REDACTED:tipo]".
 * Se `mode === "hash"`, mantém últimos 4 chars para auditoria
 * (ex.: "[REDACTED:cpf:..7890]").
 */
export function redactPii(
  text: string,
  options: { mode?: "tag" | "hash" } = {},
): { redacted: string; matches: PiiMatch[] } {
  const matches = findPii(text);
  if (matches.length === 0) return { redacted: text, matches };
  const mode = options.mode ?? "tag";
  let out = "";
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue; // overlap
    out += text.slice(cursor, m.start);
    if (mode === "hash") {
      const tail = m.match.replace(/\D/g, "").slice(-4);
      out += `[REDACTED:${m.kind}:..${tail}]`;
    } else {
      out += `[REDACTED:${m.kind}]`;
    }
    cursor = m.end;
  }
  out += text.slice(cursor);
  return { redacted: out, matches };
}

/**
 * Aplica `redactPii` em todos os valores string das linhas.
 * Não modifica o dataset original.
 */
export function redactDataset(
  dataset: Dataset,
  options: { mode?: "tag" | "hash" } = {},
): { dataset: Dataset; totalRedactions: number } {
  let total = 0;
  const redactedRows: DatasetRow[] = dataset.rows.map((row) => {
    const out: DatasetRow = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string") {
        const r = redactPii(v, options);
        total += r.matches.length;
        out[k] = r.redacted;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
  return {
    dataset: { ...dataset, rows: redactedRows },
    totalRedactions: total,
  };
}

/**
 * Detecta se o dataset contém PII em qualquer linha string.
 * Retorna o primeiro match para o caller decidir se pede confirmação.
 */
export function containsPii(dataset: Dataset): { found: boolean; sampleKinds: PiiKind[] } {
  const kinds = new Set<PiiKind>();
  // amostra de até 200 linhas para custo previsível
  const sample = dataset.rows.slice(0, 200);
  for (const row of sample) {
    for (const v of Object.values(row)) {
      if (typeof v !== "string") continue;
      const matches = findPii(v);
      for (const m of matches) kinds.add(m.kind);
      if (kinds.size >= 5) break;
    }
    if (kinds.size >= 5) break;
  }
  return { found: kinds.size > 0, sampleKinds: [...kinds] };
}
