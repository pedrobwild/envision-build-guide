import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette, CommandPaletteTrigger } from "../CommandPalette";

// jsdom não traz APIs de layout — cmdk depende delas.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver?: typeof ResizeObserverMock }).ResizeObserver ??=
  ResizeObserverMock;
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// ---- Mocks ----------------------------------------------------------------

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ profile: { roles: ["admin"] } }),
}));

const budgetsFixture = [
  {
    id: "budget-roberto",
    project_name: "Apartamento Roberto Rocha",
    client_name: "Roberto Rocha",
    sequential_code: "ORC-0042",
    status: "delivered_to_sales",
    public_id: "abc123def456",
  },
];

const clientsFixture = [
  {
    id: "client-roberto",
    name: "Roberto Rocha",
    email: "roberto@example.com",
    phone: "+55 11 99999-0000",
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const buildBudgetsBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.or = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockResolvedValue({ data: budgetsFixture, error: null });
    return builder;
  };
  const buildClientsBuilder = () => {
    const builder: any = {};
    builder.select = vi.fn().mockReturnValue(builder);
    builder.or = vi.fn().mockReturnValue(builder);
    builder.eq = vi.fn().mockReturnValue(builder);
    builder.order = vi.fn().mockReturnValue(builder);
    builder.limit = vi.fn().mockResolvedValue({ data: clientsFixture, error: null });
    return builder;
  };
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "budgets") return buildBudgetsBuilder();
        if (table === "clients") return buildClientsBuilder();
        return buildBudgetsBuilder();
      }),
    },
  };
});

// cmdk filtra resultados via fuzzy matching; o mock garante que tudo passa.
afterEach(() => {
  vi.clearAllMocks();
});

const renderPalette = () =>
  render(
    <MemoryRouter>
      <CommandPaletteTrigger />
      <CommandPalette />
    </MemoryRouter>
  );

describe("CommandPalette — busca mobile (regressão Roberto Rocha)", () => {
  it("abre via CustomEvent disparado pelo botão de busca (compatível com touch/mobile)", async () => {
    renderPalette();

    // O dialog não deve estar visível antes do trigger.
    expect(screen.queryByPlaceholderText(/Buscar orçamentos/i)).not.toBeInTheDocument();

    // Simula o tap no botão da header mobile (mesmo fluxo que falhava com KeyboardEvent sintético).
    fireEvent.click(screen.getByRole("button", { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar orçamentos/i)).toBeInTheDocument();
    });
  });

  it("abre via window.dispatchEvent('command-palette:open') programaticamente", async () => {
    renderPalette();

    act(() => {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Buscar orçamentos/i)).toBeInTheDocument();
    });
  });

  it("encontra orçamentos antigos como 'Roberto Rocha' digitando na busca", async () => {
    renderPalette();

    act(() => {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    });

    const input = await waitFor(() => screen.getByPlaceholderText(/Buscar orçamentos/i));

    // Digita a query do cliente histórico.
    fireEvent.change(input, { target: { value: "Roberto" } });

    await waitFor(() => {
      // Resultado de orçamento aparece (vem do mock do Supabase, sem filtro de data).
      expect(screen.getByText("Apartamento Roberto Rocha")).toBeInTheDocument();
      // Cliente correlato também aparece.
      expect(screen.getAllByText(/Roberto Rocha/).length).toBeGreaterThan(0);
    });
  });

  it("preserva a query digitada ao reabrir a paleta (UX mobile)", async () => {
    renderPalette();

    // Primeira abertura + digitação.
    act(() => {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    });
    const input = await waitFor(() => screen.getByPlaceholderText(/Buscar orçamentos/i));
    fireEvent.change(input, { target: { value: "Roberto" } });

    // Fecha (Escape).
    fireEvent.keyDown(input, { key: "Escape" });

    // Reabre.
    act(() => {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    });

    const reopened = await waitFor(() =>
      screen.getByPlaceholderText(/Buscar orçamentos/i)
    ) as HTMLInputElement;

    expect(reopened.value).toBe("Roberto");
  });
});
