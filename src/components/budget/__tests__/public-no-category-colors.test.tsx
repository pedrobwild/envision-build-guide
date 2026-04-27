/**
 * Garantia anti-regressão: o orçamento PÚBLICO não deve renderizar nenhuma
 * cor por categoria (pip, barra de %, ou label monetário) mesmo quando
 * receber bgClass/colorClass via props (`SectionSummaryRow`, `CategoryDetailDialog`).
 *
 * Esses componentes são renderizados na página pública dentro do `BudgetSummary`
 * e do modal de detalhes; cores devem permanecer apenas no admin.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SectionSummaryRow } from "../SectionSummaryRow";
import { CategoryDetailDialog } from "../CategoryDetailDialog";
import type { BudgetSection } from "@/types/budget";
import type { CategorizedGroup } from "@/lib/scope-categories";

// jsdom não implementa `matchMedia` por padrão; o setup global cobre,
// mas garantimos aqui no caso de execução isolada deste arquivo.
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const COLORED_TOKEN_REGEX =
  /\b(?:bg|text|border)-(?:primary|gold|charcoal-light|accent-foreground|success|warning|rose-\d+|cyan-\d+|pink-\d+|emerald-\d+|amber-\d+|red-\d+|blue-\d+|orange-\d+|yellow-\d+|green-\d+|teal-\d+|sky-\d+|indigo-\d+|violet-\d+|purple-\d+|fuchsia-\d+)\b/;

function makeSection(overrides: Partial<BudgetSection> = {}): BudgetSection {
  return {
    id: "sec-1",
    title: "Marcenaria sob medida",
    items: [
      {
        id: "it-1",
        title: "Armário planejado",
        unit_price: 1200,
        qty: 2,
        unit: "un",
      } as never,
    ],
    ...overrides,
  } as BudgetSection;
}

function makeGroup(): CategorizedGroup {
  return {
    category: {
      id: "marcenaria",
      label: "Marcenaria",
      colorClass: "text-gold",
      bgClass: "bg-gold",
      borderClass: "border-l-gold",
      matches: [],
    },
    sections: [makeSection()],
    subtotal: 2400,
  };
}

describe("Public budget — no category color leaks", () => {
  it("SectionSummaryRow não renderiza pip/barra com bgClass dinâmico", () => {
    const { container } = render(
      <SectionSummaryRow
        section={makeSection()}
        colorClass="text-gold"
        bgClass="bg-gold"
        percentage={42}
      />
    );

    // Nenhum elemento descendente pode conter classes coloridas das categorias
    container.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const cls = el.getAttribute("class") || "";
      // ignora a classe `bg-border` (neutra) — só falha em tokens coloridos da paleta
      expect(cls).not.toMatch(COLORED_TOKEN_REGEX);
    });
  });

  it("SectionSummaryRow renderiza indicador neutro de expansão (sem cores de categoria)", () => {
    const { container } = render(
      <SectionSummaryRow
        section={makeSection()}
        colorClass="text-gold"
        bgClass="bg-gold"
      />
    );

    // O indicador atual usa borda/fundo neutros (border-border/60, foreground/[0.04])
    // — basta garantir que existe um botão de expansão acessível e que nenhuma
    // classe colorida da paleta foi vazada (já coberto pelo teste anterior).
    const trigger = container.querySelector('button[aria-expanded]');
    expect(trigger).not.toBeNull();

    // Reforço: o indicador interno usa apenas tokens neutros (border-border, foreground/...)
    const neutralIndicator = container.querySelector(
      '[class*="border-border"], [class*="border-foreground"]'
    );
    expect(neutralIndicator).not.toBeNull();
  });

  it("CategoryDetailDialog não vaza colorClass/bgClass no header", () => {
    const { baseElement } = render(
      <CategoryDetailDialog open onClose={() => {}} group={makeGroup()} />
    );

    // o conteúdo do Sheet é portalizado — varremos o baseElement inteiro
    baseElement.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const cls = el.getAttribute("class") || "";
      expect(cls).not.toMatch(COLORED_TOKEN_REGEX);
    });
  });
});
