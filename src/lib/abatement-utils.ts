/**
 * Utilitários para seções de abatimento (Descontos / Créditos).
 *
 * Regras de negócio:
 * - Itens dentro de seção "Descontos" ou "Créditos" devem ter custo NEGATIVO.
 * - Se o usuário digitar um valor positivo (ou colar "R$ 3.000"), o sistema
 *   converte automaticamente para o equivalente negativo (-R$ 3.000), preservando
 *   a máscara incremental do CurrencyInput sem quebrar a digitação.
 * - Zero e null permanecem inalterados (estado vazio é válido).
 */

const ABATEMENT_TITLES = ["descontos", "créditos", "creditos"];

export function isAbatementSection(sectionTitle?: string | null): boolean {
  if (!sectionTitle) return false;
  return ABATEMENT_TITLES.includes(sectionTitle.trim().toLowerCase());
}

export function isCreditSection(sectionTitle?: string | null): boolean {
  if (!sectionTitle) return false;
  const t = sectionTitle.trim().toLowerCase();
  return t === "créditos" || t === "creditos";
}

/**
 * Normaliza um valor para o sinal correto de uma seção de abatimento.
 * - Se a seção é Desconto/Crédito e o valor é positivo, retorna o negativo.
 * - Mantém null/0/já-negativo inalterados.
 * - Para seções normais, retorna o valor original.
 */
export function normalizeAbatementValue(
  value: number | null | undefined,
  sectionTitle?: string | null,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!isAbatementSection(sectionTitle)) return value;
  if (value === 0) return 0;
  return value > 0 ? -value : value;
}
