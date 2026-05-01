/**
 * Anti-regressão: garante que o bloco "Itens do Projeto" da página pública
 * exibe TODOS os itens da seção — com ou sem imagem.
 *
 * Antes do PR `fix/public-budget-show-all-items`, itens sem imagem eram
 * silenciosamente filtrados, fazendo o cliente ver o valor cheio do
 * orçamento mas pouquíssimos itens (ou nenhum), gerando relatos como
 * "vários itens foram apagados sozinhos".
 */
import { describe, it, expect } from "vitest";
import { buildPublicScopeGroups } from "@/lib/public-scope";
import { SCOPE_CATEGORIES } from "@/lib/scope-categories";
import type { CategorizedGroup } from "@/lib/scope-categories";
import type { BudgetItem, BudgetSection } from "@/types/budget";

function makeItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: `it-${Math.random().toString(36).slice(2, 8)}`,
    title: "Item de teste",
    qty: 1,
    unit: "UN",
    coverage_type: "geral",
    included_rooms: [],
    excluded_rooms: [],
    images: [],
    ...overrides,
  };
}

function makeSection(items: BudgetItem[], title = "MARCENARIA"): BudgetSection {
  return {
    id: `sec-${Math.random().toString(36).slice(2, 8)}`,
    title,
    order_index: 0,
    items,
  };
}

function makeGroup(sections: BudgetSection[]): CategorizedGroup {
  return {
    category: SCOPE_CATEGORIES[0],
    sections,
    subtotal: 0,
  };
}

describe("buildPublicScopeGroups — escopo público mostra todos os itens", () => {
  it("preserva itens SEM imagem (regressão do filtro antigo)", () => {
    const itemSemImagem = makeItem({ title: "Cabeceira sem foto", images: [] });
    const itemComImagem = makeItem({
      title: "Bancada com foto",
      images: [{ url: "https://x/y.png", is_primary: true }],
    });
    const groups = [makeGroup([makeSection([itemSemImagem, itemComImagem])])];

    const result = buildPublicScopeGroups(groups);

    expect(result).toHaveLength(1);
    expect(result[0].sections).toHaveLength(1);
    expect(result[0].sections[0].items).toHaveLength(2);
    const titles = result[0].sections[0].items.map((i) => i.title);
    expect(titles).toContain("Cabeceira sem foto");
    expect(titles).toContain("Bancada com foto");
  });

  it("mantém seções inteiras com 0 itens com imagem (cenário Juca: 79 de 82 sem foto)", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ title: `Item ${i + 1}`, images: [] })
    );
    const groups = [makeGroup([makeSection(items, "ENXOVAL")])];

    const result = buildPublicScopeGroups(groups);

    expect(result[0].sections[0].items).toHaveLength(10);
  });

  it("remove apenas seções de fato vazias (sem itens)", () => {
    const groups = [
      makeGroup([
        makeSection([], "Seção vazia"),
        makeSection([makeItem()], "Seção com 1 item"),
      ]),
    ];

    const result = buildPublicScopeGroups(groups);

    expect(result[0].sections).toHaveLength(1);
    expect(result[0].sections[0].title).toBe("Seção com 1 item");
  });

  it("remove grupos sem nenhuma seção com itens", () => {
    const groups = [makeGroup([makeSection([], "Vazia 1"), makeSection([], "Vazia 2")])];
    const result = buildPublicScopeGroups(groups);
    expect(result).toHaveLength(0);
  });

  it("não filtra com base em coverage_type/included_rooms (escopo é responsabilidade do admin)", () => {
    const itemFiltradoAntes = makeItem({
      title: "Item com coverage 'incluir' sem rooms",
      coverage_type: "incluir",
      included_rooms: [],
    });
    const groups = [makeGroup([makeSection([itemFiltradoAntes])])];

    const result = buildPublicScopeGroups(groups);

    expect(result[0].sections[0].items[0].title).toBe(
      "Item com coverage 'incluir' sem rooms"
    );
  });
});
