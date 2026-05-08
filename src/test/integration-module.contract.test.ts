/**
 * Contract tests for the Integration module (`/admin/integracao`).
 *
 * Garantem, contra o Supabase de produção, que a migração
 * `20260507154659_integration_module.sql` foi aplicada e que o
 * postura de segurança esperada vale:
 *
 *   1. Tabelas `personal_access_tokens` e `integration_webhooks` existem
 *      e estão expostas via PostgREST (têm SELECT bloqueado por RLS,
 *      mas a tabela existe — caso contrário recebemos 404 de relação
 *      desconhecida com mensagem distinta).
 *   2. Anon não pode SELECT em nenhuma das duas tabelas (RLS admin-only).
 *   3. Anon não pode INSERT em nenhuma das duas tabelas.
 *   4. RPCs `create_personal_access_token` e `revoke_personal_access_token`
 *      existem e rejeitam a chamada anônima (a função roda como
 *      SECURITY DEFINER mas começa com `IF NOT public.has_role(..., 'admin')
 *      THEN RAISE`, retornando 403 / 42501 para qualquer não-admin).
 *
 * Esses checks rodam como **anon** — credenciais autenticadas exigiriam
 * compartilhar segredos no repo. A invariante crucial (anon nunca acessa
 * tokens) é exatamente o que precisa ser garantido.
 */
import { describe, it, expect } from "vitest";

const SUPABASE_URL = "https://pieenhgjulsrjlioozsy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWVuaGdqdWxzcmpsaW9venN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTE2NjYsImV4cCI6MjA4NzIyNzY2Nn0.n0VPTOADpoBLjPi08Am8dUy-842t_e8i7i1XqdqFdAE";

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
} as const;

interface Reply {
  status: number;
  body: unknown;
}

async function getJson(path: string): Promise<Reply> {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function postRpc(name: string, params: Record<string, unknown>): Promise<Reply> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function postInsert(table: string, payload: Record<string, unknown>): Promise<Reply> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/**
 * PostgREST sinaliza "tabela inexistente" diferente de "RLS bloqueia":
 * - Tabela ausente → 404 com `code: 42P01` ou mensagem "Could not find the table".
 * - Tabela presente + RLS → 200 com `[]`, ou 401/403 conforme a config.
 *
 * Usamos isso para falhar com uma mensagem útil quando a migração não
 * foi aplicada, em vez de mascarar o problema atrás de um teste verde.
 */
function assertRelationExists(reply: Reply, table: string): void {
  const body = reply.body as { code?: string; message?: string } | null;
  const looksMissing =
    reply.status === 404 ||
    body?.code === "42P01" ||
    (typeof body?.message === "string" &&
      /could not find the table|relation .* does not exist/i.test(body.message));
  if (looksMissing) {
    throw new Error(
      `Tabela "${table}" não existe no Supabase. ` +
        `A migração 20260507154659_integration_module.sql provavelmente ` +
        `não foi aplicada (rode \`supabase db push\`). ` +
        `Status=${reply.status}, body=${JSON.stringify(body)}`,
    );
  }
}

describe("Módulo Integração — tabelas existem em produção", () => {
  it("personal_access_tokens existe (mesmo que RLS bloqueie SELECT)", async () => {
    const reply = await getJson(
      "/rest/v1/personal_access_tokens?select=id&limit=1",
    );
    assertRelationExists(reply, "personal_access_tokens");
  });

  it("integration_webhooks existe (mesmo que RLS bloqueie SELECT)", async () => {
    const reply = await getJson(
      "/rest/v1/integration_webhooks?select=id&limit=1",
    );
    assertRelationExists(reply, "integration_webhooks");
  });
});

describe("Módulo Integração — RLS bloqueia anon", () => {
  it("anon NÃO consegue SELECT em personal_access_tokens", async () => {
    const { status, body } = await getJson(
      "/rest/v1/personal_access_tokens?select=id,token_prefix,token_hash&limit=5",
    );
    if (status === 200) {
      expect(Array.isArray(body)).toBe(true);
      expect((body as unknown[]).length).toBe(0);
    } else {
      expect([401, 403]).toContain(status);
    }
  });

  it("anon NÃO consegue SELECT em integration_webhooks", async () => {
    const { status, body } = await getJson(
      "/rest/v1/integration_webhooks?select=id,url,secret&limit=5",
    );
    if (status === 200) {
      expect(Array.isArray(body)).toBe(true);
      expect((body as unknown[]).length).toBe(0);
    } else {
      expect([401, 403]).toContain(status);
    }
  });

  it("anon NÃO consegue INSERT em personal_access_tokens", async () => {
    // Mesmo se RLS deixasse passar, NOT NULL em created_by garantiria erro
    // — mas o objetivo aqui é o WITH CHECK admin-only.
    const reply = await postInsert("personal_access_tokens", {
      name: "test-anon",
      token_prefix: "bwild_pat_aa",
      token_hash: "00".repeat(32),
      scopes: ["read"],
    });
    expect([401, 403]).toContain(reply.status);
  });

  it("anon NÃO consegue INSERT em integration_webhooks", async () => {
    const reply = await postInsert("integration_webhooks", {
      name: "test-anon",
      url: "https://example.invalid/hook",
      events: [],
    });
    expect([401, 403]).toContain(reply.status);
  });
});

describe("Módulo Integração — RPCs existem e exigem admin", () => {
  it("create_personal_access_token existe e rejeita anon", async () => {
    const { status, body } = await postRpc("create_personal_access_token", {
      p_name: "test-from-anon",
      p_scopes: ["read"],
      p_expires_at: null,
    });

    // Cenários aceitáveis:
    //   - 401/403 (PostgREST barra antes do `IF has_role`).
    //   - 400 com SQLSTATE 42501 (a função roda mas levanta a exceção).
    // Inaceitável: 404 (RPC não existe) ou 200 (token criado!).
    if (status === 200) {
      throw new Error(
        `RPC create_personal_access_token retornou 200 para anon — ` +
          `o gate has_role('admin') está quebrado. body=${JSON.stringify(body)}`,
      );
    }
    if (status === 404) {
      throw new Error(
        "RPC create_personal_access_token não existe (404). " +
          "A migração 20260507154659_integration_module.sql não foi aplicada.",
      );
    }
    expect([400, 401, 403]).toContain(status);
  });

  it("revoke_personal_access_token existe e rejeita anon", async () => {
    const { status, body } = await postRpc("revoke_personal_access_token", {
      p_id: "00000000-0000-0000-0000-000000000000",
    });

    if (status === 200) {
      throw new Error(
        `RPC revoke_personal_access_token retornou 200 para anon — ` +
          `o gate has_role('admin') está quebrado. body=${JSON.stringify(body)}`,
      );
    }
    if (status === 404) {
      throw new Error(
        "RPC revoke_personal_access_token não existe (404). " +
          "A migração 20260507154659_integration_module.sql não foi aplicada.",
      );
    }
    expect([400, 401, 403]).toContain(status);
  });
});
