import { describe, it, expect } from "vitest";
import {
  getCategoryForSection,
  categorizeSections,
  SCOPE_CATEGORIES,
} from "../scope-categories";
import type { BudgetSection } from "@/types/budget";

const makeSection = (
  id: string,
  title: string,
  overrides: Partial<BudgetSection> = {},
): BudgetSection => ({
  id,
  title,
  order_index: 0,
  items: [],
  ...overrides,
});

describe("getCategoryForSection", () => {
  it("classifica títulos exatos", () => {
    expect(getCategoryForSection("Marcenaria").id).toBe("marcenaria");
    expect(getCategoryForSection("Mobiliário").id).toBe("mobiliario");
    expect(getCategoryForSection("Enxoval").id).toBe("enxoval");
  });

  it("ignora caixa e acentos via normalização", () => {
    expect(getCategoryForSection("MARCENARIA").id).toBe("marcenaria");
    expect(getCategoryForSection("decoração").id).toBe("decoracao");
    expect(getCategoryForSection("Decoracao").id).toBe("decoracao");
    expect(getCategoryForSection("Mobiliario").id).toBe("mobiliario");
  });

  it("acha categoria por substring (matches parciais)", () => {
    expect(getCategoryForSection("Projeto Arquitetônico Completo").id).toBe("projetos");
    expect(getCategoryForSection("Serviços Civis e Demolições").id).toBe("infraestrutura");
    expect(getCategoryForSection("Revestimentos Cerâmicos").id).toBe("acabamentos");
    expect(getCategoryForSection("Eletrodomésticos importados").id).toBe("eletro");
  });

  it("trata variações de acabamentos (pintura, vidros, metais)", () => {
    expect(getCategoryForSection("Pinturas internas").id).toBe("acabamentos");
    expect(getCategoryForSection("Vidros e espelhos").id).toBe("acabamentos");
    expect(getCategoryForSection("Bancadas em granito").id).toBe("acabamentos");
  });

  it("trata variações de utensílios", () => {
    expect(getCategoryForSection("Utensílios domésticos").id).toBe("utensilios");
    expect(getCategoryForSection("Kit hospede").id).toBe("utensilios");
  });

  it("cai em 'outros' quando nenhum match", () => {
    expect(getCategoryForSection("xyzzyabc").id).toBe("outros");
    expect(getCategoryForSection("").id).toBe("outros");
    expect(getCategoryForSection("Categoria Inventada").id).toBe("outros");
  });

  it("retorna o objeto completo da categoria com cores", () => {
    const cat = getCategoryForSection("Marcenaria");
    expect(cat.label).toBe("Marcenaria");
    expect(cat.bgClass).toContain("bg-");
    expect(cat.colorClass).toContain("text-");
    expect(cat.borderClass).toContain("border-l-");
  });
});

describe("categorizeSections", () => {
  it("agrupa seções por categoria", () => {
    const sections: BudgetSection[] = [
      makeSection("1", "Marcenaria"),
      makeSection("2", "Mobiliário"),
      makeSection("3", "Marcenaria de cozinha"),
    ];
    const groups = categorizeSections(sections);
    expect(groups).toHaveLength(2);
    const marcenaria = groups.find((g) => g.category.id === "marcenaria")!;
    expect(marcenaria.sections).toHaveLength(2);
  });

  it("retorna apenas grupos não-vazios", () => {
    const sections: BudgetSection[] = [makeSection("1", "Marcenaria")];
    const groups = categorizeSections(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("marcenaria");
  });

  it("preserva a ordem definida em SCOPE_CATEGORIES", () => {
    const sections: BudgetSection[] = [
      makeSection("1", "Enxoval"),
      makeSection("2", "Projetos"),
      makeSection("3", "Marcenaria"),
    ];
    const groups = categorizeSections(sections);
    const ids = groups.map((g) => g.category.id);
    const expectedOrder = SCOPE_CATEGORIES.map((c) => c.id).filter((id) => ids.includes(id));
    expect(ids).toEqual(expectedOrder);
    // Projetos vem antes de Marcenaria, que vem antes de Enxoval
    expect(ids.indexOf("projetos")).toBeLessThan(ids.indexOf("marcenaria"));
    expect(ids.indexOf("marcenaria")).toBeLessThan(ids.indexOf("enxoval"));
  });

  it("acumula subtotal por categoria", () => {
    const sections: BudgetSection[] = [
      makeSection("1", "Marcenaria", {
        items: [
          {
            id: "i1",
            title: "Armário",
            internal_unit_price: 1000,
            qty: 2,
            bdi_percentage: 0,
          },
        ],
      }),
      makeSection("2", "Marcenaria de quarto", {
        items: [
          {
            id: "i2",
            title: "Closet",
            internal_unit_price: 500,
            qty: 1,
            bdi_percentage: 0,
          },
        ],
      }),
    ];
    const groups = categorizeSections(sections);
    const marcenaria = groups.find((g) => g.category.id === "marcenaria")!;
    expect(marcenaria.subtotal).toBe(2500);
  });

  it("array vazio retorna array vazio", () => {
    expect(categorizeSections([])).toEqual([]);
  });

  it("seções sem match caem em 'outros'", () => {
    const sections = [makeSection("1", "Categoria desconhecida")];
    const groups = categorizeSections(sections);
    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("outros");
  });
});
