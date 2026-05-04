/**
 * Normaliza um número de telefone brasileiro para o formato esperado pelo
 * link `https://wa.me/<E.164 sem +>`.
 *
 * Regras:
 * - Remove qualquer caractere não numérico (parênteses, espaços, traços, "+").
 * - Se vier só com DDD + número (10 ou 11 dígitos), prefixa "55" (Brasil).
 * - Se já vier com 12 ou 13 dígitos começando com "55", mantém.
 * - Caso contrário (internacional não-BR ou inválido), retorna apenas dígitos.
 *
 * Exemplos:
 *   "(11) 91234-5678"  → "5511912345678"
 *   "+55 11 91234-5678" → "5511912345678"
 *   "1133334444"       → "551133334444"
 *   "5511912345678"    → "5511912345678"
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // já tem código do país BR
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  // número BR sem código do país (DDD + 8 ou 9 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  // formato desconhecido — devolve só dígitos (wa.me ainda tenta abrir)
  return digits;
}

/**
 * Constrói a URL do WhatsApp Web/App. Retorna null se o número for inválido.
 */
export function buildWhatsappUrl(raw: string | null | undefined, message?: string): string | null {
  const num = toWhatsappNumber(raw);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
