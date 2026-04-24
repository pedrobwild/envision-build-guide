/**
 * Verificação automatizada das rotas públicas de orçamento.
 *
 * O que faz:
 *  1. Busca via Supabase REST os 10 orçamentos publicados mais recentes.
 *  2. Para cada orçamento, valida em paralelo:
 *      a) GET /o/<public_id>  → HTML responde 200 e contém <div id="root">
 *      b) GET /obra/<public_id> → idem (rota legada)
 *      c) Cada <script src> e <link rel="stylesheet"> referenciado no HTML
 *         responde HTTP 200 (chunks Vite com hash não desapareceram)
 *      d) RPC get_public_budget(p_public_id) responde 200 com payload não-nulo
 *  3. Imprime relatório por orçamento e resumo final.
 *
 * Uso:
 *   npx tsx scripts/verify-public-budgets.ts
 *   npx tsx scripts/verify-public-budgets.ts --base https://orcamento-bwild.lovable.app
 *
 * Sai com código 1 se qualquer verificação falhar — adequado para CI.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://pieenhgjulsrjlioozsy.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWVuaGdqdWxzcmpsaW9venN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTE2NjYsImV4cCI6MjA4NzIyNzY2Nn0.n0VPTOADpoBLjPi08Am8dUy-842t_e8i7i1XqdqFdAE";

const args = process.argv.slice(2);
const baseFlagIdx = args.indexOf("--base");
const BASE_URL =
  (baseFlagIdx >= 0 ? args[baseFlagIdx + 1] : undefined) ??
  process.env.PUBLIC_BUDGET_BASE_URL ??
  "https://orcamento-bwild.lovable.app";

interface BudgetRow {
  public_id: string;
  project_name: string;
  client_name: string;
  status: string;
}

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

interface BudgetReport {
  publicId: string;
  projectName: string;
  clientName: string;
  checks: CheckResult[];
}

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function ok(label: string, detail = ""): CheckResult {
  return { label, ok: true, detail };
}
function fail(label: string, detail: string): CheckResult {
  return { label, ok: false, detail };
}

async function fetchPublishedBudgets(limit = 10): Promise<BudgetRow[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/budgets`);
  url.searchParams.set(
    "select",
    "public_id,project_name,client_name,status,updated_at"
  );
  url.searchParams.set("status", "eq.published");
  url.searchParams.set("public_id", "not.is.null");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status} ${await res.text()}`);
  return (await res.json()) as BudgetRow[];
}

/** Extrai URLs absolutas de scripts e stylesheets do HTML. */
function extractAssetUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  // <script src="...">
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  // <link rel="stylesheet" ... href="..."> (em qualquer ordem dos atributos)
  const linkStyleRe =
    /<link[^>]+(?:rel=["']stylesheet["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']stylesheet["'])/gi;
  // <link rel="modulepreload" href="..."> — chunks lazy do Vite
  const modulePreloadRe =
    /<link[^>]+(?:rel=["']modulepreload["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']modulepreload["'])/gi;

  for (const re of [scriptRe, linkStyleRe, modulePreloadRe]) {
    for (const m of html.matchAll(re)) {
      const raw = m[1] ?? m[2];
      if (!raw) continue;
      // Ignora data:, blob:, externos óbvios não controlados por nós
      if (raw.startsWith("data:") || raw.startsWith("blob:")) continue;
      try {
        urls.add(new URL(raw, baseUrl).toString());
      } catch {
        /* URL inválida, ignora */
      }
    }
  }
  return [...urls];
}

async function checkAssetReachable(url: string): Promise<CheckResult> {
  try {
    // HEAD primeiro (mais barato); se 405/403, fallback para GET parcial.
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok && (res.status === 405 || res.status === 403)) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
      });
    }
    if (res.ok || res.status === 206) {
      return ok(`asset ${url}`, `${res.status}`);
    }
    return fail(`asset ${url}`, `HTTP ${res.status}`);
  } catch (err) {
    return fail(`asset ${url}`, (err as Error).message);
  }
}

async function checkRoute(routeUrl: string): Promise<{
  htmlCheck: CheckResult;
  assetChecks: CheckResult[];
}> {
  let html = "";
  try {
    const res = await fetch(routeUrl, { redirect: "follow" });
    if (!res.ok) {
      return {
        htmlCheck: fail(`HTML ${routeUrl}`, `HTTP ${res.status}`),
        assetChecks: [],
      };
    }
    html = await res.text();
    if (!html.includes('id="root"')) {
      return {
        htmlCheck: fail(`HTML ${routeUrl}`, "sem <div id=\"root\">"),
        assetChecks: [],
      };
    }
  } catch (err) {
    return {
      htmlCheck: fail(`HTML ${routeUrl}`, (err as Error).message),
      assetChecks: [],
    };
  }

  const baseHref = new URL(routeUrl).origin;
  const assets = extractAssetUrls(html, baseHref);
  const assetChecks = await Promise.all(assets.map(checkAssetReachable));
  return {
    htmlCheck: ok(`HTML ${routeUrl}`, `200, ${assets.length} assets`),
    assetChecks,
  };
}

async function checkRpc(publicId: string): Promise<CheckResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_budget`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_public_id: publicId }),
    });
    if (!res.ok) {
      return fail(`RPC ${publicId}`, `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return fail(`RPC ${publicId}`, "payload vazio");
    }
    return ok(`RPC ${publicId}`, "payload OK");
  } catch (err) {
    return fail(`RPC ${publicId}`, (err as Error).message);
  }
}

async function verifyBudget(b: BudgetRow): Promise<BudgetReport> {
  const checks: CheckResult[] = [];

  // /o/<id> — rota canônica
  const oRoute = `${BASE_URL}/o/${b.public_id}`;
  const oResult = await checkRoute(oRoute);
  checks.push(oResult.htmlCheck, ...oResult.assetChecks);

  // /obra/<id> — rota legada (mesma SPA)
  const obraRoute = `${BASE_URL}/obra/${b.public_id}`;
  const obraResult = await checkRoute(obraRoute);
  checks.push(obraResult.htmlCheck, ...obraResult.assetChecks);

  // RPC pública (dados do orçamento)
  checks.push(await checkRpc(b.public_id));

  return {
    publicId: b.public_id,
    projectName: b.project_name,
    clientName: b.client_name,
    checks,
  };
}

function printReport(reports: BudgetReport[]) {
  console.log(
    `\n${C.bold}${C.cyan}━━━ Verificação de orçamentos públicos ━━━${C.reset}`
  );
  console.log(`${C.dim}Base URL: ${BASE_URL}${C.reset}`);
  console.log(`${C.dim}Supabase: ${SUPABASE_URL}${C.reset}\n`);

  let totalChecks = 0;
  let totalFails = 0;
  let budgetsWithFailures = 0;

  for (const r of reports) {
    const fails = r.checks.filter((c) => !c.ok);
    totalChecks += r.checks.length;
    totalFails += fails.length;
    if (fails.length > 0) budgetsWithFailures++;

    const status = fails.length === 0 ? `${C.green}✓` : `${C.red}✗`;
    console.log(
      `${status} ${C.bold}${r.publicId}${C.reset} ${C.dim}${r.projectName}${C.reset}`
    );
    if (fails.length > 0) {
      for (const f of fails) {
        console.log(`    ${C.red}└─ ${f.label}: ${f.detail}${C.reset}`);
      }
    } else {
      console.log(
        `    ${C.dim}${r.checks.length} verificações OK${C.reset}`
      );
    }
  }

  console.log(`\n${C.bold}━━━ Resumo ━━━${C.reset}`);
  console.log(`Orçamentos verificados: ${reports.length}`);
  console.log(`Verificações totais:    ${totalChecks}`);
  console.log(
    `Falhas:                 ${totalFails > 0 ? C.red : C.green}${totalFails}${C.reset}`
  );
  console.log(
    `Orçamentos com falha:   ${
      budgetsWithFailures > 0 ? C.red : C.green
    }${budgetsWithFailures}${C.reset}\n`
  );

  return totalFails === 0;
}

async function main() {
  console.log(`${C.dim}Buscando 10 orçamentos publicados mais recentes...${C.reset}`);
  const budgets = await fetchPublishedBudgets(10);
  if (budgets.length === 0) {
    console.error(`${C.yellow}Nenhum orçamento publicado encontrado.${C.reset}`);
    process.exit(1);
  }
  console.log(`${C.dim}Encontrados ${budgets.length}. Verificando rotas e assets...${C.reset}`);

  // Paralelo, mas com limite de 3 simultâneos para não saturar a CDN.
  const reports: BudgetReport[] = [];
  const concurrency = 3;
  for (let i = 0; i < budgets.length; i += concurrency) {
    const slice = budgets.slice(i, i + concurrency);
    const batch = await Promise.all(slice.map(verifyBudget));
    reports.push(...batch);
  }

  const allOk = printReport(reports);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(`${C.red}Erro fatal: ${(err as Error).message}${C.reset}`);
  process.exit(1);
});
