/**
 * Diagnóstico de RLS para a rota pública do orçamento.
 *
 * Por que existe:
 *  Quando um link público "não abre", a causa mais comum (depois de cache
 *  obsoleto) é uma policy de RLS bloqueando o acesso anônimo. Este módulo
 *  testa o acesso usando o **mesmo contexto do cliente final** — chave anon,
 *  sem sessão — e compara com o contexto autenticado do operador para
 *  apontar com precisão onde a permissão está faltando.
 *
 * Saída: lista de checks (tabela/RPC, papel testado, ok/falha) e um conjunto
 * de recomendações textuais (não-SQL) para o operador agir, mais o SQL
 * sugerido pronto para ser executado por um admin no editor de migrations.
 */
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type RlsCheckRole = "anon" | "current_user";
export type RlsCheckStatus = "ok" | "blocked" | "error" | "skipped";

export interface RlsCheck {
  id: string;
  label: string;
  /** Nome técnico do recurso testado: "rpc:get_public_budget", "table:sections" etc. */
  resource: string;
  role: RlsCheckRole;
  status: RlsCheckStatus;
  message: string;
  /** Mensagem original do servidor (Postgres/PostgREST), quando houver. */
  serverError?: string;
}

export interface RlsRecommendation {
  /** Severidade visual: critical bloqueia o acesso, info é sugestão. */
  severity: "critical" | "warning" | "info";
  title: string;
  body: string;
  /** SQL opcional pronto para um admin executar (visível em <pre>). */
  sql?: string;
}

export interface RlsDiagnosticReport {
  publicId: string;
  authenticated: boolean;
  authenticatedUserEmail: string | null;
  authenticatedRoles: string[];
  checks: RlsCheck[];
  recommendations: RlsRecommendation[];
  generatedAt: string;
}

/**
 * Cliente isolado, sem sessão persistida — simula exatamente o que o
 * navegador de um cliente final (sem login) enxerga ao abrir a URL pública.
 * Usa a mesma anon key da app principal.
 */
function makeAnonClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedContext(): Promise<{
  authenticated: boolean;
  email: string | null;
  roles: string[];
}> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return { authenticated: false, email: null, roles: [] };

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return {
    authenticated: true,
    email: user.email ?? null,
    roles: (roleRows ?? []).map((r) => String(r.role)),
  };
}

/** Roda o diagnóstico completo de RLS para um public_id. */
export async function diagnoseBudgetRls(publicId: string): Promise<RlsDiagnosticReport> {
  const checks: RlsCheck[] = [];
  const ctx = await getAuthenticatedContext();
  const anon = makeAnonClient();

  // 1) RPC pública via anon (este é o caminho real do cliente final)
  {
    const { data, error } = await anon.rpc("get_public_budget", { p_public_id: publicId });
    if (error) {
      checks.push({
        id: "anon_rpc",
        label: "RPC get_public_budget (anônimo)",
        resource: "rpc:get_public_budget",
        role: "anon",
        status: "error",
        message: "RPC retornou erro para usuário anônimo.",
        serverError: error.message,
      });
    } else if (!data) {
      checks.push({
        id: "anon_rpc",
        label: "RPC get_public_budget (anônimo)",
        resource: "rpc:get_public_budget",
        role: "anon",
        status: "blocked",
        message:
          "RPC respondeu null. Pode ser status ≠ published/minuta_solicitada OU EXECUTE negado para o role 'anon'.",
      });
    } else {
      checks.push({
        id: "anon_rpc",
        label: "RPC get_public_budget (anônimo)",
        resource: "rpc:get_public_budget",
        role: "anon",
        status: "ok",
        message: "Cliente final consegue carregar o orçamento via RPC.",
      });
    }
  }

  // 2) RPC via usuário autenticado (controle: se OK aqui mas falha no anon, é RLS/EXECUTE)
  if (ctx.authenticated) {
    const { data, error } = await supabase.rpc("get_public_budget", { p_public_id: publicId });
    if (error) {
      checks.push({
        id: "auth_rpc",
        label: "RPC get_public_budget (você)",
        resource: "rpc:get_public_budget",
        role: "current_user",
        status: "error",
        message: "RPC retornou erro também para o usuário logado.",
        serverError: error.message,
      });
    } else if (!data) {
      checks.push({
        id: "auth_rpc",
        label: "RPC get_public_budget (você)",
        resource: "rpc:get_public_budget",
        role: "current_user",
        status: "blocked",
        message: "Mesmo logado, a RPC retornou null — provavelmente status ≠ published.",
      });
    } else {
      checks.push({
        id: "auth_rpc",
        label: "RPC get_public_budget (você)",
        resource: "rpc:get_public_budget",
        role: "current_user",
        status: "ok",
        message: "Você (logado) consegue carregar via RPC.",
      });
    }
  } else {
    checks.push({
      id: "auth_rpc",
      label: "RPC get_public_budget (você)",
      resource: "rpc:get_public_budget",
      role: "current_user",
      status: "skipped",
      message: "Você não está autenticado — pulando comparação.",
    });
  }

  // 3) Acesso direto à tabela budgets via anon (precisamos do id para os próximos passos)
  let budgetIdForAnon: string | null = null;
  {
    const { data, error } = await anon
      .from("budgets")
      .select("id, status, public_id")
      .eq("public_id", publicId)
      .maybeSingle();
    if (error) {
      checks.push({
        id: "anon_budgets",
        label: "SELECT em budgets (anônimo)",
        resource: "table:budgets",
        role: "anon",
        status: "error",
        message: "Anônimo recebeu erro ao consultar budgets.",
        serverError: error.message,
      });
    } else if (!data) {
      checks.push({
        id: "anon_budgets",
        label: "SELECT em budgets (anônimo)",
        resource: "table:budgets",
        role: "anon",
        status: "blocked",
        message:
          "Anônimo não enxerga a linha. Confirme que existe policy SELECT permitindo status público (published/minuta_solicitada) para o role 'anon'.",
      });
    } else {
      budgetIdForAnon = data.id;
      checks.push({
        id: "anon_budgets",
        label: "SELECT em budgets (anônimo)",
        resource: "table:budgets",
        role: "anon",
        status: "ok",
        message: `Anônimo enxerga a linha (status="${data.status}").`,
      });
    }
  }

  // 4) Sections + items para o cliente anônimo (mesma policy do PublicBudget.tsx)
  if (budgetIdForAnon) {
    const { data: secs, error: secErr } = await anon
      .from("sections")
      .select("id")
      .eq("budget_id", budgetIdForAnon);
    if (secErr) {
      checks.push({
        id: "anon_sections",
        label: "SELECT em sections (anônimo)",
        resource: "table:sections",
        role: "anon",
        status: "error",
        message: "Anônimo não consegue ler as seções.",
        serverError: secErr.message,
      });
    } else {
      checks.push({
        id: "anon_sections",
        label: "SELECT em sections (anônimo)",
        resource: "table:sections",
        role: "anon",
        status: secs && secs.length > 0 ? "ok" : "blocked",
        message:
          secs && secs.length > 0
            ? `Anônimo lê ${secs.length} seção(ões).`
            : "Anônimo não recebe nenhuma seção. Verifique policy de sections para budgets publicados.",
      });

      if (secs && secs.length > 0) {
        const ids = secs.map((s) => s.id);
        const { data: itemsRows, error: itemsErr } = await anon
          .from("items")
          .select("id")
          .in("section_id", ids);
        if (itemsErr) {
          checks.push({
            id: "anon_items",
            label: "SELECT em items (anônimo)",
            resource: "table:items",
            role: "anon",
            status: "error",
            message: "Anônimo não consegue ler os itens.",
            serverError: itemsErr.message,
          });
        } else {
          checks.push({
            id: "anon_items",
            label: "SELECT em items (anônimo)",
            resource: "table:items",
            role: "anon",
            status: itemsRows && itemsRows.length > 0 ? "ok" : "blocked",
            message:
              itemsRows && itemsRows.length > 0
                ? `Anônimo lê ${itemsRows.length} item(ns).`
                : "Anônimo não recebe itens. Verifique policy de items para seções de budgets publicados.",
          });
        }
      }
    }
  }

  // ─── Geração de recomendações ───
  const recommendations: RlsRecommendation[] = [];
  const find = (id: string) => checks.find((c) => c.id === id);

  const anonRpc = find("anon_rpc");
  const authRpc = find("auth_rpc");
  const anonBudgets = find("anon_budgets");
  const anonSections = find("anon_sections");
  const anonItems = find("anon_items");

  // Caso clássico: você (logado) vê, anônimo não → policy/EXECUTE faltando
  if (anonRpc?.status !== "ok" && authRpc?.status === "ok") {
    recommendations.push({
      severity: "critical",
      title: "Cliente final está bloqueado pela RPC pública",
      body:
        "Você consegue carregar o orçamento autenticado, mas o cliente final (anônimo) não. " +
        "Garanta que a RPC get_public_budget é SECURITY DEFINER e que o role 'anon' tem EXECUTE.",
      sql: `-- Reaplicar permissão de EXECUTE no role anônimo
GRANT EXECUTE ON FUNCTION public.get_public_budget(text) TO anon;`,
    });
  }

  if (anonRpc?.status === "blocked" && authRpc?.status === "blocked") {
    recommendations.push({
      severity: "warning",
      title: "Orçamento provavelmente não está publicado",
      body:
        "Tanto você quanto o cliente recebem RPC vazia. A causa mais comum NÃO é RLS — é o status interno: " +
        "a RPC só devolve linhas com status IN ('published', 'minuta_solicitada'). " +
        "Abra o orçamento no editor e use 'Publicar'.",
    });
  }

  if (anonRpc?.status === "error") {
    recommendations.push({
      severity: "critical",
      title: "RPC retornou erro de servidor para anônimos",
      body:
        "A chamada anônima quebrou no servidor. Veja o erro em 'Detalhes' — costuma ser função inexistente, " +
        "assinatura divergente ou EXECUTE revogado.",
      sql: `-- Conferir e reaplicar EXECUTE
GRANT EXECUTE ON FUNCTION public.get_public_budget(text) TO anon, authenticated;`,
    });
  }

  if (anonBudgets?.status === "blocked") {
    recommendations.push({
      severity: "warning",
      title: "Tabela budgets sem policy de leitura pública",
      body:
        "O cliente final não enxerga a linha em budgets. A página pública usa a RPC para contornar isso, " +
        "então não bloqueia o render — mas se o seu front também consulta direto a tabela, será bloqueado. " +
        "Considere uma policy SELECT específica para status público.",
      sql: `-- Permitir leitura anônima APENAS de orçamentos publicados
CREATE POLICY "Anon can read published budgets"
  ON public.budgets
  FOR SELECT
  TO anon
  USING (status IN ('published', 'minuta_solicitada') AND public_id IS NOT NULL);`,
    });
  }

  if (anonSections?.status === "blocked" || anonSections?.status === "error") {
    recommendations.push({
      severity: "critical",
      title: "Tabela sections bloqueada para anônimos",
      body:
        "A página pública lê as seções diretamente. Sem policy de SELECT para 'anon' restrita a orçamentos publicados, o conteúdo principal fica vazio.",
      sql: `-- Permitir leitura anônima de seções de orçamentos publicados
CREATE POLICY "Anon can read sections of published budgets"
  ON public.sections
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = sections.budget_id
        AND b.status IN ('published', 'minuta_solicitada')
        AND b.public_id IS NOT NULL
    )
  );`,
    });
  }

  if (anonItems?.status === "blocked" || anonItems?.status === "error") {
    recommendations.push({
      severity: "critical",
      title: "Tabela items bloqueada para anônimos",
      body:
        "Mesmo com seções visíveis, os itens (descrições, valores) ficam ocultos sem policy de SELECT para 'anon'.",
      sql: `-- Permitir leitura anônima de itens de seções de orçamentos publicados
CREATE POLICY "Anon can read items of published budgets"
  ON public.items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.sections s
      JOIN public.budgets b ON b.id = s.budget_id
      WHERE s.id = items.section_id
        AND b.status IN ('published', 'minuta_solicitada')
        AND b.public_id IS NOT NULL
    )
  );`,
    });
  }

  if (!ctx.authenticated) {
    recommendations.push({
      severity: "info",
      title: "Você não está autenticado nesta sessão",
      body:
        "Sem login não é possível comparar acesso anônimo vs. operador. Faça login com sua conta admin/orçamentista para um diagnóstico completo.",
    });
  }

  if (recommendations.length === 0 && checks.every((c) => c.status === "ok" || c.status === "skipped")) {
    recommendations.push({
      severity: "info",
      title: "Permissões consistentes",
      body: "Anônimo e operador têm o mesmo acesso esperado. Se o link continua sem abrir, a causa não é RLS.",
    });
  }

  return {
    publicId,
    authenticated: ctx.authenticated,
    authenticatedUserEmail: ctx.email,
    authenticatedRoles: ctx.roles,
    checks,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
