/**
 * Verificação automática de paridade entre Supabase e types gerados.
 *
 * Garante que todas as tabelas usadas em runtime pelo frontend
 * estão presentes em `src/integrations/supabase/types.ts`. Caso
 * contrário, falha com código ≠ 0 (ideal para rodar antes do build).
 *
 * Uso:
 *   bun scripts/verify-supabase-types.ts
 *   ou: tsx scripts/verify-supabase-types.ts
 *
 * Para adicionar novas tabelas críticas, inclua o nome em
 * `REQUIRED_TABLES` abaixo.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TYPES_PATH = resolve(__dirname, "../src/integrations/supabase/types.ts");

/**
 * Tabelas obrigatórias no schema público.
 * Mantenha esta lista sincronizada conforme novas tabelas são
 * adicionadas e consumidas pelo frontend.
 */
const REQUIRED_TABLES = [
  "elephant_insights_cache",
  "budgets",
  "clients",
  "budget_meetings",
  "user_roles",
] as const;

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`\n❌ verify-supabase-types: ${message}\n`);
  process.exit(1);
}

function ok(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`✅ verify-supabase-types: ${message}`);
}

function main() {
  if (!existsSync(TYPES_PATH)) {
    fail(`Arquivo de types não encontrado em ${TYPES_PATH}`);
  }

  const content = readFileSync(TYPES_PATH, "utf-8");
  const missing: string[] = [];

  for (const table of REQUIRED_TABLES) {
    // Busca declarações como `table_name: {` dentro do bloco Tables
    const pattern = new RegExp(`\\b${table}\\s*:\\s*\\{`, "m");
    if (!pattern.test(content)) {
      missing.push(table);
    }
  }

  if (missing.length > 0) {
    fail(
      `Tabelas ausentes nos types gerados: ${missing.join(", ")}\n` +
        `→ Rode uma migração no Supabase ou regenere os types antes do build.`,
    );
  }

  ok(`Todas as ${REQUIRED_TABLES.length} tabelas obrigatórias estão presentes nos types.`);
}

main();
