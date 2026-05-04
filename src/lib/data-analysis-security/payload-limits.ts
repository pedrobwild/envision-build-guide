/**
 * Limites de tamanho de payload — defesa em profundidade contra
 * abuse / OOM / custos elevados de LLM.
 *
 * Use no edge function (`assertPayloadSize` antes do parse) e no front
 * (`checkDatasetSize` antes de mandar).
 */

import type { Dataset } from "@/components/ai-analysis/types";

/** Máx. bytes em request body. 1 MB padrão. */
export const MAX_PAYLOAD_BYTES = 1_048_576;
/** Máx. linhas em dataset enviado para análise. */
export const MAX_DATASET_ROWS = 50_000;
/** Máx. colunas. */
export const MAX_DATASET_COLS = 200;
/** Máx. caracteres em string single (texto livre). */
export const MAX_STRING_CHARS = 10_000;

export class PayloadTooLargeError extends Error {
  readonly status = 413;
  constructor(message: string, readonly meta?: Record<string, number>) {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export function assertPayloadSize(raw: string, limit: number = MAX_PAYLOAD_BYTES): void {
  // string length em UTF-16 é boa aproximação superior do byte count
  // (caracteres BMP cabem em 1-4 bytes UTF-8, mas length em chars já dá teto seguro)
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > limit) {
    throw new PayloadTooLargeError(
      `Payload excede ${(limit / 1024).toFixed(0)} KB (recebido: ${(bytes / 1024).toFixed(1)} KB).`,
      { bytes, limit },
    );
  }
}

export interface DatasetSizeReport {
  ok: boolean;
  rows: number;
  cols: number;
  reason?: string;
}

export function checkDatasetSize(
  dataset: Pick<Dataset, "columns" | "rows">,
  limits: { maxRows?: number; maxCols?: number } = {},
): DatasetSizeReport {
  const maxRows = limits.maxRows ?? MAX_DATASET_ROWS;
  const maxCols = limits.maxCols ?? MAX_DATASET_COLS;
  const rows = dataset.rows.length;
  const cols = dataset.columns.length;
  if (rows > maxRows) {
    return { ok: false, rows, cols, reason: `Máximo ${maxRows} linhas (recebido ${rows}).` };
  }
  if (cols > maxCols) {
    return { ok: false, rows, cols, reason: `Máximo ${maxCols} colunas (recebido ${cols}).` };
  }
  return { ok: true, rows, cols };
}

/**
 * Trunca strings muito longas em todas as linhas. Para evitar passar
 * texto livre gigante (logs colados, transcrições) ao LLM.
 */
export function truncateLongStrings(
  dataset: Dataset,
  limit: number = MAX_STRING_CHARS,
): { dataset: Dataset; truncated: number } {
  let count = 0;
  const rows = dataset.rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "string" && v.length > limit) {
        out[k] = v.slice(0, limit) + `…[+${v.length - limit} chars truncados]`;
        count++;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
  return { dataset: { ...dataset, rows }, truncated: count };
}
