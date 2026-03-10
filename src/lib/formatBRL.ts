export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/** "15 de abril de 2026" */
export function formatDateLong(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

/** Returns expiry date and days left for a budget */
export function getValidityInfo(date: string | null | undefined, validityDays: number = 30) {
  const baseDate = date ? new Date(date) : new Date();
  const expiresAt = new Date(baseDate.getTime() + validityDays * 86400000);
  const now = new Date();
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
  return { expiresAt, daysLeft, expired: daysLeft <= 0 };
}
