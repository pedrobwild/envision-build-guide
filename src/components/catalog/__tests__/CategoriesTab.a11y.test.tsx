import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoriesTab } from "../CategoriesTab";
import type { CatalogCategory } from "../CategoryDialog";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver?: typeof ResizeObserverMock }).ResizeObserver ??=
  ResizeObserverMock;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const sampleCategories: CatalogCategory[] = [
  {
    id: "cat-active",
    name: "Hidráulica",
    description: "Tubos e conexões",
    is_active: true,
    category_type: "Produtos",
    sort_order: 0,
  },
  {
    id: "cat-inactive",
    name: "Pintura",
    description: null,
    is_active: false,
    category_type: "Prestadores",
    sort_order: 1,
  },
];

const renderTab = () =>
  render(
    <CategoriesTab
      categories={sampleCategories}
      onNewCategory={() => {}}
      onEditCategory={() => {}}
      onRefresh={() => {}}
    />,
  );

describe("CategoriesTab — acessibilidade dos botões de ação", () => {
  it("o botão de editar tem aria-label específico para a categoria", () => {
    renderTab();
    expect(
      screen.getByRole("button", { name: "Editar categoria Hidráulica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Editar categoria Pintura" }),
    ).toBeInTheDocument();
  });

  it("o botão de excluir tem aria-label específico para a categoria", () => {
    renderTab();
    expect(
      screen.getByRole("button", { name: "Excluir categoria Hidráulica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Excluir categoria Pintura" }),
    ).toBeInTheDocument();
  });

  it("o toggle de status expõe estado via aria-pressed", () => {
    renderTab();
    const desativar = screen.getByRole("button", {
      name: "Desativar categoria Hidráulica",
    });
    expect(desativar).toHaveAttribute("aria-pressed", "true");

    const ativar = screen.getByRole("button", {
      name: "Ativar categoria Pintura",
    });
    expect(ativar).toHaveAttribute("aria-pressed", "false");
  });
});
