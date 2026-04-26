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
];

export function looksLikeBulkCommand(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  return BULK_TRIGGERS.some((rx) => rx.test(t));
}

export function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
}
