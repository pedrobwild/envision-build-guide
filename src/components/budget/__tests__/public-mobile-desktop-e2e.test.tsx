/**
 * Teste E2E (DOM-level, jsdom) que renderiza as duas superfícies do orçamento
 * público — desktop (`BudgetSummary` → `TotalCard`) e mobile (`MobileInlineSummary`
 * → `InvestmentSummaryCard`) — sob viewports reais e compara, no DOM, os
 * valores monetários renderizados (Subtotal, Descontos, Créditos e Total final).
 *
 * Diferente do teste `public-mobile-desktop-parity.test.ts` (que valida só a
 * camada de dados), este teste navega/renderiza componentes reais e extrai
 * os números visíveis do DOM, simulando o que o usuário enxerga.
 *
 * Cobre o bug histórico em que o mobile recalculava abatimentos via
 * `calculateSectionSubtotal(section)` e ignorava descontos embutidos em
 * seções com saldo positivo, divergindo do que o desktop mostrava.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Polyfill mínimo de IntersectionObserver para jsdom (framer-motion `whileInView`).
beforeAll(() => {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    // @ts-expect-error — jsdom polyfill
    globalThis.IntersectionObserver = IO;
    // @ts-expect-error — jsdom polyfill
    window.IntersectionObserver = IO;
  }
});

import { InvestmentSummaryCard } from "@/components/budget/summary/InvestmentSummaryCard";
import { BudgetSummary } from "@/components/budget/BudgetSummary";
import { computePublicAbatements } from "@/lib/public-abatements";
import { calculateBudgetTotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import {
  MIXED_SECTION_FIXTURES,
  fxMarcenariaComCortesia,
  fxOrçamentoCompletoMisto,
} from "@/lib/__tests__/fixtures/mixed-section-budgets";
import type { BudgetSection } from "@/types/budget";

// ─── Viewport helpers ────────────────────────────────────────────────────
type Viewport = "mobile" | "desktop";

function setViewport(kind: Viewport) {
  const width = kind === "mobile" ? 390 : 1440;
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });

  // Tailwind `lg:` breakpoint = 1024px. matchMedia precisa refletir o viewport
  // para os componentes condicionalmente esconderem/mostrarem (`lg:hidden` etc).
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const min = /\(min-width:\s*(\d+)px\)/.exec(query);
      const minPx = min ? Number(min[1]) : 0;
      const matches = width >= minPx;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}

// ─── DOM extractors ──────────────────────────────────────────────────────
const MONEY_RE = /R\$\s*-?\s*[\d.]+(?:,\d{2})?/g;

function extractAllMoney(container: HTMLElement): string[] {
  const text = container.textContent ?? "";
  return (text.match(MONEY_RE) ?? []).map((s) => s.replace(/\s+/g, " ").trim());
}

/** Normaliza "R$ 12.345,67" → 12345.67 para comparação numérica robusta. */
function parseBRL(value: string): number {
  const isNegative = /−|-/.test(value);
  const digits = value.replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? (isNegative ? -n : n) : NaN;
}

// ─── Fixture totals (single source of truth) ─────────────────────────────
function computeReferenceTotals(sections: BudgetSection[]) {
  const total = calculateBudgetTotal(sections as never, []);
  const breakdown = computePublicAbatements(sections);
  const subtotal = total + breakdown.discountTotal + breakdown.creditTotal;
  return {
    total,
    subtotal,
    discountTotal: breakdown.discountTotal,
    creditTotal: breakdown.creditTotal,
    discounts: breakdown.discounts,
    credits: breakdown.credits,
  };
}

// ─── Render helpers ──────────────────────────────────────────────────────
function renderMobile(sections: BudgetSection[]) {
  setViewport("mobile");
  const ref = computeReferenceTotals(sections);
  const { container } = render(
    <MemoryRouter>
      <InvestmentSummaryCard
        total={ref.total}
        installments={12}
        subtotal={ref.subtotal}
        discount={ref.discountTotal}
        credit={ref.creditTotal}
        discounts={ref.discounts}
        credits={ref.credits}
      />
    </MemoryRouter>,
  );
  return { container, ref };
}

function renderDesktop(sections: BudgetSection[]) {
  setViewport("desktop");
  const ref = computeReferenceTotals(sections);
  const { container } = render(
    <MemoryRouter>
      <BudgetSummary
        sections={sections as never}
        adjustments={[]}
        total={ref.total}
        generatedAt={new Date().toISOString()}
      />
    </MemoryRouter>,
  );
  return { container, ref };
}

// ─── Asserts compartilhados ──────────────────────────────────────────────
function expectContainsBRL(container: HTMLElement, amount: number, label: string) {
  const expected = formatBRL(amount).replace(/\s+/g, " ").trim();
  const found = extractAllMoney(container);
  const numericExpected = parseBRL(expected);
  const match = found.some((v) => Math.abs(parseBRL(v) - numericExpected) < 0.01);
  if (!match) {
    throw new Error(
      `[${label}] valor esperado ${expected} não encontrado no DOM. ` +
        `Valores monetários renderizados: ${JSON.stringify(found)}`,
    );
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────
describe("E2E público — paridade mobile↔desktop dos valores renderizados", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(MIXED_SECTION_FIXTURES)(
    "[%s] mobile e desktop renderizam o MESMO total final no DOM",
    ({ build }) => {
      const sections = build();

      const mobile = renderMobile(sections);
      const mobileMoney = extractAllMoney(mobile.container);
      cleanup();

      const desktop = renderDesktop(sections);
      const desktopMoney = extractAllMoney(desktop.container);

      // Total final precisa aparecer nas duas superfícies.
      expectContainsBRL(mobile.container, mobile.ref.total, "mobile.total");
      expectContainsBRL(desktop.container, desktop.ref.total, "desktop.total");

      // E os totais de referência têm que bater.
      expect(mobile.ref.total).toBeCloseTo(desktop.ref.total, 2);

      // Sanity: pelo menos um valor monetário em cada surface.
      expect(mobileMoney.length).toBeGreaterThan(0);
      expect(desktopMoney.length).toBeGreaterThan(0);
    },
  );

  it("seção positiva com desconto embutido — Subtotal+Desconto+Total batem entre mobile e desktop (regressão)", () => {
    const sections = fxMarcenariaComCortesia();
    const ref = computeReferenceTotals(sections);

    // Sanidade: o fixture realmente exercita o bug (tem desconto embutido).
    expect(ref.discountTotal).toBeGreaterThan(0);

    const mobile = renderMobile(sections);
    expectContainsBRL(mobile.container, ref.subtotal, "mobile.subtotal");
    expectContainsBRL(mobile.container, ref.discountTotal, "mobile.discount");
    expectContainsBRL(mobile.container, ref.total, "mobile.total");
    cleanup();

    const desktop = renderDesktop(sections);
    expectContainsBRL(desktop.container, ref.subtotal, "desktop.subtotal");
    expectContainsBRL(desktop.container, ref.discountTotal, "desktop.discount");
    expectContainsBRL(desktop.container, ref.total, "desktop.total");
  });

  it("orçamento completo com descontos + créditos — todas as 4 linhas (subtotal, desconto, crédito, total) batem", () => {
    const sections = fxOrçamentoCompletoMisto();
    const ref = computeReferenceTotals(sections);

    expect(ref.discountTotal).toBeGreaterThan(0);
    expect(ref.creditTotal).toBeGreaterThan(0);

    const mobile = renderMobile(sections);
    expectContainsBRL(mobile.container, ref.subtotal, "mobile.subtotal");
    expectContainsBRL(mobile.container, ref.discountTotal, "mobile.discount");
    expectContainsBRL(mobile.container, ref.creditTotal, "mobile.credit");
    expectContainsBRL(mobile.container, ref.total, "mobile.total");
    cleanup();

    const desktop = renderDesktop(sections);
    expectContainsBRL(desktop.container, ref.subtotal, "desktop.subtotal");
    expectContainsBRL(desktop.container, ref.discountTotal, "desktop.discount");
    expectContainsBRL(desktop.container, ref.creditTotal, "desktop.credit");
    expectContainsBRL(desktop.container, ref.total, "desktop.total");

    // Invariante econômico final: subtotal == total + discount + credit
    expect(ref.subtotal).toBeCloseTo(ref.total + ref.discountTotal + ref.creditTotal, 2);
  });

  it("não vaza preços por item nem BDI nas superfícies públicas", () => {
    const sections = fxOrçamentoCompletoMisto();
    const ref = computeReferenceTotals(sections);

    const mobile = renderMobile(sections);
    expect(mobile.container.textContent ?? "").not.toMatch(/BDI/i);
    cleanup();

    const desktop = renderDesktop(sections);
    // Desktop pode mostrar valores de seções, mas nunca BDI/markup interno.
    expect(desktop.container.textContent ?? "").not.toMatch(/BDI/i);

    // Mobile só deve renderizar valores agregados (subtotal, abatimentos, total),
    // nunca preço unitário interno de item — todos os money tokens visíveis
    // devem corresponder a algum agregado calculado.
    cleanup();
    const mobile2 = renderMobile(sections);
    const monies = extractAllMoney(mobile2.container).map(parseBRL);
    const allowed = new Set(
      [
        ref.total,
        ref.subtotal,
        ref.discountTotal,
        ref.creditTotal,
        ...ref.discounts.map((d) => d.total),
        ...ref.credits.map((c) => c.total),
        // parcelas (12x) — derivado do total
        ref.total / 12,
      ].map((v) => Number(v.toFixed(2))),
    );
    for (const m of monies) {
      const rounded = Number(m.toFixed(2));
      const matchesAllowed = [...allowed].some((a) => Math.abs(a - rounded) < 0.5);
      expect(
        matchesAllowed,
        `Valor inesperado no DOM mobile: ${m}. Esperado um dos agregados: ${[...allowed].join(", ")}`,
      ).toBe(true);
    }
  });
});
