import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PriceHistoryPopover } from "../PriceHistoryPopover";

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
// Radix Popover usa hasPointerCapture; jsdom não implementa.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

let mockResponse: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
};

vi.mock("@/integrations/supabase/client", () => {
  const buildBuilder = () => {
    const builder: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockImplementation(() => Promise.resolve(mockResponse));
    return builder;
  };
  return {
    supabase: { from: vi.fn(() => buildBuilder()) },
  };
});

afterEach(() => {
  vi.clearAllMocks();
  mockResponse = { data: [], error: null };
});

const renderPopover = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PriceHistoryPopover
        catalogItemId="item-1"
        supplierId="sup-1"
        supplierName="Fornecedor Alpha"
      />
    </QueryClientProvider>,
  );
};

describe("PriceHistoryPopover", () => {
  it("o gatilho expõe um aria-label descritivo (não apenas title)", () => {
    renderPopover();
    const trigger = screen.getByRole("button", {
      name: /Ver histórico de preço de Fornecedor Alpha/i,
    });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("mostra estado de erro humano + ação de recuperação quando a query falha", async () => {
    mockResponse = { data: null, error: { message: "boom" } };
    renderPopover();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Ver histórico de preço de Fornecedor Alpha/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Não consegui carregar o histórico/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Tentar novamente/i }),
    ).toBeInTheDocument();
  });

  it("mostra mensagem amigável de empty state quando não há histórico", async () => {
    mockResponse = { data: [], error: null };
    renderPopover();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Ver histórico de preço de Fornecedor Alpha/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Sem alterações registradas/i),
      ).toBeInTheDocument();
    });
  });
});
