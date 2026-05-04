/**
 * Compõe o título exibido no cabeçalho de um negócio a partir de
 * `project_name` e `client_name`, evitando duplicação visual quando os dois
 * campos diferem apenas por espaços extras, pontuação (· • - – — |) ou
 * acentuação.
 *
 * Regras:
 *  - Se um dos campos estiver vazio, retorna o outro.
 *  - Se, após normalizar, forem equivalentes ou um contiver o outro, mostra
 *    apenas o mais completo (preferindo o original, sem reformatar).
 *  - Caso contrário, concatena com " · ".
 */
export function composeBudgetTitle(
  projectName: string | null | undefined,
  clientName: string | null | undefined,
): string {
  const proj = (projectName || "").trim();
  const client = (clientName || "").trim();
  if (!proj) return client;
  if (!client) return proj;

  const np = normalizeForCompare(proj);
  const nc = normalizeForCompare(client);
  if (!np) return client;
  if (!nc) return proj;
  if (np === nc) return proj;
  if (np.includes(nc)) return proj;
  if (nc.includes(np)) return client;
  return `${proj} · ${client}`;
}

/**
 * Normaliza string para comparação: remove acentos, colapsa pontuação comum
 * de separação e espaços múltiplos, e força lowercase.
 */
export function normalizeForCompare(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s·•\-–—|]+/g, " ")
    .trim()
    .toLowerCase();
}
