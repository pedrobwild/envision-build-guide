import {
  FileAudio,
  FileSpreadsheet,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
} from "lucide-react";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileIconFor(mime: string, name: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return FileText;
  if (/\.(xlsx|xls|csv)$/i.test(name)) return FileSpreadsheet;
  if (/\.(docx|txt|md|json)$/i.test(name)) return FileText;
  return FileIcon;
}

const BULK_TRIGGERS = [
  /\b(reduz(ir|a)|aument(ar|a)|aplique|aplicar)\b.+?\b(\d+%|\d+\s*(reais|r\$))/i,
  /\b(mover|mude|alter(ar|e))\b.+?\b(status|etapa|pipeline)\b/i,
  /\batribu(ir|a)\b.+?(comercial|or[çc]amentista|respons[áa]vel)/i,
  /\b(em lote|todos os or[çc]amentos|nos or[çc]amentos)\b/i,
  /\b(todo o sistema|sistema inteiro|geral(mente)?|de forma geral)\b/i,
];

/** Patterns that signal "scan everything" — no date filter required. */
const ALL_SCOPE_PATTERNS = [
  /\btodos( os)?( or[çc]amentos)?\b/i,
  /\btodo o sistema\b/i,
  /\bsistema inteiro\b/i,
  /\bno sistema\b/i,
  /\bgeral(mente)?\b/i,
  /\bsem (filtro|data)\b/i,
];

export function looksLikeBulkCommand(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  return BULK_TRIGGERS.some((rx) => rx.test(t));
}

/** Returns true when the command explicitly targets "all eligible budgets". */
export function isAllScopeCommand(text: string): boolean {
  const t = text.trim();
  return ALL_SCOPE_PATTERNS.some((rx) => rx.test(t));
}

export function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Detects whether a bulk command looks like a financial percentage adjustment
 * (e.g. "reduzir 10% nos orçamentos…") and validates the numeric portion.
 */
export type CommandFactorCheck =
  | { kind: "not-financial" }
  | { kind: "valid"; percent: number }
  | { kind: "invalid"; reason: string };

const FINANCIAL_KEYWORDS = /\b(reduz(ir|a)|aument(ar|a)|desconto|aplique|aplicar)\b/i;

export function validateFinancialCommandFactor(text: string): CommandFactorCheck {
  const t = text.trim();
  if (!FINANCIAL_KEYWORDS.test(t)) return { kind: "not-financial" };

  const match = t.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!match) {
    return {
      kind: "invalid",
      reason:
        "Não consegui identificar o percentual. Use por exemplo: \"reduzir 10% nos orçamentos…\".",
    };
  }

  const raw = match[1].replace(",", ".");
  const value = Number(raw);

  if (!Number.isFinite(value)) {
    return { kind: "invalid", reason: "O percentual informado não é um número válido." };
  }
  if (value <= 0) {
    return {
      kind: "invalid",
      reason:
        "O percentual precisa ser maior que zero. Para anular um desconto, peça um aumento equivalente.",
    };
  }
  if (value > 100) {
    return {
      kind: "invalid",
      reason: `O percentual ${value}% é maior que 100% e zeraria os valores. Use um valor entre 0,1% e 100%.`,
    };
  }
  return { kind: "valid", percent: value };
}

/**
 * Validates the `factor` returned by the edge function inside `plan.params`
 * before triggering the apply step. Defends against malformed payloads.
 */
export function validatePlanFactor(params: Record<string, unknown> | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (!params) return { ok: true };
  if (!("factor" in params)) return { ok: true };
  const factor = (params as { factor?: unknown }).factor;
  if (typeof factor !== "number" || !Number.isFinite(factor)) {
    return { ok: false, reason: "O fator de ajuste retornado é inválido (não é um número finito)." };
  }
  if (factor <= 0) {
    return {
      ok: false,
      reason: `O fator de ajuste retornado (${factor}) precisa ser maior que zero. Operação cancelada por segurança.`,
    };
  }
  if (factor > 10) {
    return {
      ok: false,
      reason: `O fator de ajuste retornado (${factor}) parece exagerado (>10x). Reformule o comando para evitar mudanças catastróficas.`,
    };
  }
  return { ok: true };
}
