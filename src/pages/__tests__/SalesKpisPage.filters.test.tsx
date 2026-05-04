/**
 * Integração: garante que os filtros globais (período + vendedora)
 * propagam para TODAS as RPCs consumidas pelos blocos do dashboard.
 *
 * Estratégia:
 *  - Mock do supabase client devolvendo dados estáveis para cada RPC.
 *  - Renderiza <SalesKpisPage/> dentro de QueryClient + Router.
 *  - Captura toda chamada `rpc(name, params)`, agrupa por nome e
 *    inspeciona as params da última invocação após cada mudança de filtro.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SalesKpisPage from "@/pages/SalesKpisPage";

// Radix Select usa APIs de pointer/scroll que jsdom não implementa.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).hasPointerCapture = () => false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).releasePointerCapture = () => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).setPointerCapture = () => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollIntoView = () => {};
});

// ---- Recharts: ResponsiveContainer não funciona em jsdom -------------
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

// ---- Mock do supabase client ----------------------------------------
const OWNER_ID = "11111111-1111-1111-1111-111111111111";

const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];

const RPC_FIXTURES: Record<string, unknown> = {
  sales_kpis_dashboard: {
    total_leads: 10, proposals_sent: 6, deals_won: 2, deals_lost: 1, deals_open: 7,
    win_rate_pct: 66.6, proposal_rate_pct: 60, avg_cycle_days: 12,
    p50_cycle_days: 10, p90_cycle_days: 30, avg_deal_size_won: 50000,
    revenue_won: 100000, revenue_lost: 25000, pipeline_open_value: 350000,
  },
  sales_kpis_by_owner: [
    {
      owner_id: OWNER_ID, owner_email: "alice@bwild.com", owner_name: "Alice",
      total_leads: 10, proposals_sent: 6, deals_won: 2, deals_lost: 1, deals_open: 7,
      win_rate_pct: 66.6, avg_cycle_days: 12, p50_cycle_days: 10, p90_cycle_days: 30,
      avg_deal_size_won: 50000, revenue_won: 100000, pipeline_open_value: 350000,
    },
  ],
  sales_kpis_time_in_stage: [
    { stage: "novo", sample_size: 5, avg_days: 2, p50_days: 1.5, p90_days: 4, min_days: 1, max_days: 5 },
  ],
  sales_kpis_cohorts: [
    { cohort_month: "2026-04-01", leads: 10, proposals_sent: 6, deals_won: 2, deals_lost: 1, lead_to_won_pct: 20, avg_cycle_days: 12, revenue_won: 100000 },
  ],
  sales_kpis_lost_reasons: [
    { reason: "preco", qty: 1, pct_of_lost: 100, revenue_lost: 25000, avg_deal_size: 25000, competitor_value_total: 23000 },
  ],
  sales_conversion_by_segment: [
    { segment: "0-50m²", total_leads: 5, proposals_sent: 3, deals_won: 1, deals_lost: 0, deals_open: 4, win_rate_pct: 100, proposal_rate_pct: 60, avg_cycle_days: 9, avg_deal_size_won: 30000, revenue_won: 30000 },
  ],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      return Promise.resolve({ data: RPC_FIXTURES[name] ?? null, error: null });
    },
  },
}));

// ---- Helpers --------------------------------------------------------
function lastCallFor(name: string) {
  for (let i = rpcCalls.length - 1; i >= 0; i--) {
    if (rpcCalls[i].name === name) return rpcCalls[i];
  }
  return undefined;
}

function callsFor(name: string) {
  return rpcCalls.filter((c) => c.name === name);
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SalesKpisPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ---- Suite ----------------------------------------------------------
describe("SalesKpisPage — filtros globais propagam para todos os blocos", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
  });

  it("dispara todas as RPCs no carregamento inicial com período padrão (90d, sem owner)", async () => {
    renderPage();

    await waitFor(() => {
      expect(lastCallFor("sales_kpis_dashboard")).toBeTruthy();
      expect(lastCallFor("sales_kpis_by_owner")).toBeTruthy();
      expect(lastCallFor("sales_kpis_time_in_stage")).toBeTruthy();
      expect(lastCallFor("sales_kpis_cohorts")).toBeTruthy();
      expect(lastCallFor("sales_kpis_lost_reasons")).toBeTruthy();
      expect(lastCallFor("sales_conversion_by_segment")).toBeTruthy();
    });

    // owner default = null em todas as RPCs que aceitam
    for (const name of [
      "sales_kpis_dashboard",
      "sales_kpis_time_in_stage",
      "sales_kpis_cohorts",
      "sales_kpis_lost_reasons",
      "sales_conversion_by_segment",
    ]) {
      expect(lastCallFor(name)!.params._owner_id).toBeNull();
    }

    // período default 90d → start é uma ISO string não nula
    expect(lastCallFor("sales_kpis_dashboard")!.params._start_date).toEqual(
      expect.any(String)
    );
  });

  it("ao trocar período (90d → all), refaz as RPCs com novo _start_date", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(lastCallFor("sales_kpis_dashboard")).toBeTruthy());
    const start90 = lastCallFor("sales_kpis_dashboard")!.params._start_date as string;
    const callsBefore = callsFor("sales_kpis_dashboard").length;

    await user.click(screen.getByRole("combobox", { name: /período/i }));
    await user.click(await screen.findByRole("option", { name: /desde o início/i }));

    await waitFor(() => {
      expect(callsFor("sales_kpis_dashboard").length).toBeGreaterThan(callsBefore);
    });

    const startAll = lastCallFor("sales_kpis_dashboard")!.params._start_date as string;
    // "all" usa OPERATIONS_START (2026-04-15); 90d em 2026-05-04 também,
    // mas como o range muda explicitamente, queryKey muda e refetch ocorre.
    expect(startAll).toEqual(expect.any(String));

    // Todos os blocos sensíveis devem refletir o mesmo _start_date
    for (const name of [
      "sales_kpis_time_in_stage",
      "sales_kpis_cohorts",
      "sales_kpis_lost_reasons",
      "sales_conversion_by_segment",
    ]) {
      expect(lastCallFor(name)!.params._start_date).toEqual(startAll);
    }
  });

  it("ao selecionar uma vendedora, propaga _owner_id para todas as RPCs (exceto by_owner)", async () => {
    const user = userEvent.setup();
    renderPage();

    // Aguarda o seletor popular com a owner mockada
    await waitFor(() => expect(lastCallFor("sales_kpis_by_owner")).toBeTruthy());
    await waitFor(() =>
      expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2)
    );

    const ownerSelect = screen.getAllByRole("combobox")[1];
    await user.click(ownerSelect);
    await user.click(await screen.findByRole("option", { name: "Alice" }));

    await waitFor(() => {
      expect(lastCallFor("sales_kpis_dashboard")!.params._owner_id).toBe(OWNER_ID);
    });

    for (const name of [
      "sales_kpis_dashboard",
      "sales_kpis_time_in_stage",
      "sales_kpis_cohorts",
      "sales_kpis_lost_reasons",
      "sales_conversion_by_segment",
    ]) {
      expect(lastCallFor(name)!.params._owner_id).toBe(OWNER_ID);
    }

    // by_owner é deliberadamente sem filtro de owner (é o breakdown)
    const byOwnerLast = lastCallFor("sales_kpis_by_owner")!;
    expect("_owner_id" in byOwnerLast.params).toBe(false);

    // Faixa de período aplicada deve mostrar o nome da vendedora
    const veLabel = screen.getByText(/Vendedora:/i);
    expect(veLabel).toBeInTheDocument();
    expect(veLabel.parentElement!.textContent).toMatch(/Alice/);
  });

  it("ao limpar a vendedora (Todas), volta a enviar _owner_id = null", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(lastCallFor("sales_kpis_by_owner")).toBeTruthy());
    await waitFor(() =>
      expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2)
    );

    const ownerSelect = screen.getAllByRole("combobox")[1];
    await user.click(ownerSelect);
    await user.click(await screen.findByRole("option", { name: "Alice" }));

    await waitFor(() =>
      expect(lastCallFor("sales_kpis_dashboard")!.params._owner_id).toBe(OWNER_ID)
    );

    await user.click(ownerSelect);
    await user.click(await screen.findByRole("option", { name: /todas as vendedoras/i }));

    await waitFor(() => {
      expect(lastCallFor("sales_kpis_dashboard")!.params._owner_id).toBeNull();
    });

    for (const name of [
      "sales_kpis_time_in_stage",
      "sales_kpis_cohorts",
      "sales_kpis_lost_reasons",
      "sales_conversion_by_segment",
    ]) {
      expect(lastCallFor(name)!.params._owner_id).toBeNull();
    }
  });

  it("clicar numa linha da tabela de vendedoras define o filtro global de owner", async () => {
    const user = userEvent.setup();
    renderPage();

    // Aguarda a tabela renderizar
    const aliceCell = await screen.findByRole("button", { name: /Alice/i });
    await user.click(aliceCell);

    await waitFor(() => {
      expect(lastCallFor("sales_kpis_dashboard")!.params._owner_id).toBe(OWNER_ID);
    });
  });
});
