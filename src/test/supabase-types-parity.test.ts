/**
 * Teste de paridade Supabase ⇄ types.ts
 *
 * Roda como parte do `bun test` (vitest) e falha o build se alguma
 * tabela crítica usada em runtime estiver ausente em
 * `src/integrations/supabase/types.ts`. Funciona como uma "rede de
 * segurança" automática contra builds quebrados por dessincronização.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TYPES_PATH = resolve(process.cwd(), "src/integrations/supabase/types.ts");

const REQUIRED_TABLES = [
  "elephant_insights_cache",
  "budgets",
  "clients",
  "budget_meetings",
  "user_roles",
] as const;

describe("Supabase types parity", () => {
  it("types.ts existe", () => {
    expect(existsSync(TYPES_PATH)).toBe(true);
  });

  it.each(REQUIRED_TABLES)(
    "tabela '%s' está presente nos types gerados",
    (table) => {
      const content = readFileSync(TYPES_PATH, "utf-8");
      // Procura por declarações como `<nome>: {` dentro do bloco Tables.
      const pattern = new RegExp(`\\b${table}\\s*:\\s*\\{`, "m");
      expect(
        pattern.test(content),
        `Tabela "${table}" não encontrada em types.ts. ` +
          `Rode uma migração no Supabase ou regenere os types antes do build.`,
      ).toBe(true);
    },
  );
});
