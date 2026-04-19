/**
 * Sanitiza um termo de busca antes de interpolá-lo em filtros `.or()` do PostgREST.
 *
 * O parser do PostgREST utiliza `,`, `(`, `)`, `:`, `.` e `*` como caracteres
 * estruturais. Quando esses símbolos aparecem em strings vindas do usuário e
 * são embutidos diretamente em `name.ilike.%${q}%,...`, podem:
 *   - Quebrar a query (resultando em 400)
 *   - Subverter o filtro (ex.: digitar `a,name.eq.x` adiciona uma condição extra)
 *
 * Aspas e barras invertidas também são tratadas para evitar erros de parsing.
 */
export function sanitizePostgrestPattern(input: string): string {
  return input
    .trim()
    .replace(/[,()'"\\:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
