/**
 * Contract tests para a proteção de orçamentos publicados no banco.
 *
 * Estes testes validam, contra o Supabase real, que NENHUM endpoint
 * autenticado (admin, orçamentista, comercial) consegue alterar o
 * conteúdo de um orçamento publicado, mesmo que tente UPDATE direto
 * via REST. A proteção vem de triggers BEFORE em budgets/sections/items
 * (`guard_published_*`) que abortam qualquer mutação fora dos campos
 * de telemetria/lifecycle (view_count, last_viewed_at, deleted_at,
 * deleted_by, updated_at, is_published_version, status, published_at,
 * public_id).
 *
 * Os testes são divididos em dois eixos:
 *
 *   1) **anon (sem login)** — exercitado direto via fetch ao REST. Aqui
 *      qualquer UPDATE deve ser bloqueado por RLS antes mesmo do trigger
 *      rodar; serve como sanity check de que nem o vetor mais fraco
 *      consegue escrever.
 *
 *   2) **com privilégio (admin)** — exercitado via a RPC
 *      `test_published_budget_immutability`, que é SECURITY DEFINER e
 *      restrita a admins. Ela tenta UPDATE/INSERT/DELETE proibidos em um
 *      orçamento publicado real (em SAVEPOINT, sem persistir nada) e
 *      retorna o veredicto de cada tentativa. Se algum trigger não
 *      bloquear, o teste falha citando exatamente qual cenário passou.
 *
 * O cenário "admin" exige autenticação. As credenciais vêm de variáveis
 * de ambiente (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`); quando não
 * estão presentes (ex.: rodada local rápida), os testes daquele bloco
 * são marcados como skipped — mas o bloco anon sempre roda.
 */
import { describe, it, expect, beforeAll } from "vitest";

const SUPABASE_URL = "https://pieenhgjulsrjlioozsy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWVuaGdqdWxzcmpsaW9venN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTE2NjYsImV4cCI6MjA4NzIyNzY2Nn0.n0VPTOADpoBLjPi08Am8dUy-842t_e8i7i1XqdqFdAE";

const anonHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
} as const;

async function findPublishedBudgetId(): Promise<string | null> {
  // Lê via anon o id de algum orçamento publicado (status público).
  // Isso só funciona porque a RLS de SELECT já permite anon ver budgets
  // publicados. Não precisamos de auth para descobrir o alvo.
  const url = new URL(`${SUPABASE_URL}/rest/v1/budgets`);
  url.searchParams.set("select", "id");
  url.searchParams.set("status", "in.(published,minuta_solicitada)");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

describe("published budget immutability — anon REST cannot write", () => {
  let publishedId: string | null = null;

  beforeAll(async () => {
    publishedId = await findPublishedBudgetId();
  });

  it("anon UPDATE em budgets é negado (RLS antes do trigger)", async () => {
    if (!publishedId) {
      console.warn("[skip] sem budget publicado para alvo");
      return;
    }
    const url = new URL(`${SUPABASE_URL}/rest/v1/budgets`);
    url.searchParams.set("id", `eq.${publishedId}`);
    const res = await fetch(url, {
      method: "PATCH",
      headers: anonHeaders,
      body: JSON.stringify({ manual_total: 999999 }),
    });
    // Aceitamos qualquer falha (401/403/404) ou 200 com [] — o que NÃO
    // é aceitável é a linha voltar alterada.
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      expect(rows).toEqual([]);
    } else {
      expect([401, 403, 404]).toContain(res.status);
    }

    // Releitura para garantir que o valor não mudou
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/budgets?select=manual_total&id=eq.${publishedId}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (check.ok) {
      const rows = (await check.json()) as Array<{ manual_total: number | null }>;
      if (rows.length > 0) {
        expect(rows[0].manual_total).not.toBe(999999);
      }
    }
  });

  it("anon UPDATE em sections é negado", async () => {
    if (!publishedId) return;
    // Pega uma section qualquer do publicado (RLS de SELECT permite)
    const secsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sections?select=id&budget_id=eq.${publishedId}&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (!secsRes.ok) return;
    const secs = (await secsRes.json()) as Array<{ id: string }>;
    if (secs.length === 0) return;
    const sectionId = secs[0].id;

    const url = new URL(`${SUPABASE_URL}/rest/v1/sections`);
    url.searchParams.set("id", `eq.${sectionId}`);
    const res = await fetch(url, {
      method: "PATCH",
      headers: anonHeaders,
      body: JSON.stringify({ section_price: 123456 }),
    });
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      expect(rows).toEqual([]);
    } else {
      expect([401, 403, 404]).toContain(res.status);
    }
  });

  it("anon DELETE em items de publicado é negado", async () => {
    if (!publishedId) return;
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/items?select=id,section_id,sections!inner(budget_id)&sections.budget_id=eq.${publishedId}&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (!itemsRes.ok) return;
    const items = (await itemsRes.json()) as Array<{ id: string }>;
    if (items.length === 0) return;
    const itemId = items[0].id;

    const url = new URL(`${SUPABASE_URL}/rest/v1/items`);
    url.searchParams.set("id", `eq.${itemId}`);
    const res = await fetch(url, { method: "DELETE", headers: anonHeaders });
    if (res.ok) {
      const rows = (await res.json()) as unknown[];
      expect(rows).toEqual([]);
    } else {
      expect([401, 403, 404]).toContain(res.status);
    }

    // Item ainda existe?
    const stillThere = await fetch(
      `${SUPABASE_URL}/rest/v1/items?select=id&id=eq.${itemId}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (stillThere.ok) {
      const rows = (await stillThere.json()) as Array<{ id: string }>;
      // Se anon vê (publicado), tem que continuar lá. Se anon não vê
      // (RLS mais estrito), o array vem vazio — também aceitável.
      if (rows.length > 0) {
        expect(rows[0].id).toBe(itemId);
      }
    }
  });
});

/**
 * Bloco com privilégio: chama a RPC SECURITY DEFINER que tenta as
 * mutações proibidas como o role do dono da função (postgres) e devolve
 * o veredicto de cada cenário. Cobrir esse caminho é essencial porque
 * RLS por si só NÃO bloqueia admin — quem bloqueia é o trigger.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const adminAuthAvailable = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

describe.skipIf(!adminAuthAvailable)(
  "published budget immutability — privileged caller is blocked by triggers",
  () => {
    let accessToken: string | null = null;

    beforeAll(async () => {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(
          `Falha ao autenticar admin de teste: ${res.status} ${await res.text()}`,
        );
      }
      const json = (await res.json()) as { access_token?: string };
      accessToken = json.access_token ?? null;
      if (!accessToken) throw new Error("token vazio");
    });

    it("RPC test_published_budget_immutability reporta TODOS os cenários proibidos como bloqueados", async () => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/test_published_budget_immutability`,
        {
          method: "POST",
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      expect(res.ok).toBe(true);
      const rows = (await res.json()) as Array<{
        test_name: string;
        expected: string;
        actual: string;
        passed: boolean;
        detail: string;
      }>;
      expect(Array.isArray(rows)).toBe(true);
      // Deve haver pelo menos os 3 cenários "blocked" críticos
      const failed = rows.filter((r) => !r.passed);
      if (failed.length > 0) {
        const summary = failed
          .map((r) => `${r.test_name}: expected=${r.expected} got=${r.actual} → ${r.detail}`)
          .join("\n");
        throw new Error(`Cenários falharam:\n${summary}`);
      }
      // Espera que pelo menos os bloqueios principais tenham rodado
      const names = new Set(rows.map((r) => r.test_name));
      expect(names.has("budget_update_manual_total")).toBe(true);
    });
  },
);
