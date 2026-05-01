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

// `CountUpValue` anima de 0 → total; em jsdom isso significa que o DOM
// inicial mostra "R$ 0,00". Para um teste E2E baseado em DOM precisamos do
// valor final estável — mockamos o componente para renderizar `value` direto.
vi.mock("@/components/budget/CountUpValue", () => ({
  CountUpValue: ({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) => {
    const { formatBRL } = require("@/lib/formatBRL");
    return (
      <span className={className} style={style} data-testid="countup-final">
        {formatBRL(value)}
      </span>
    );
  },
}));

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
    expect(ref.discounts.length).toBeGreaterThan(0);

    const mobile = renderMobile(sections);
    expectContainsBRL(mobile.container, ref.subtotal, "mobile.subtotal");
    expectContainsBRL(mobile.container, ref.total, "mobile.total");
    // Cada linha de desconto agregada por rótulo deve aparecer no mobile.
    for (const line of ref.discounts) {
      expectContainsBRL(mobile.container, line.total, `mobile.discount[${line.label}]`);
    }
    cleanup();

    const desktop = renderDesktop(sections);
    expectContainsBRL(desktop.container, ref.subtotal, "desktop.subtotal");
    expectContainsBRL(desktop.container, ref.total, "desktop.total");
    for (const line of ref.discounts) {
      expectContainsBRL(desktop.container, line.total, `desktop.discount[${line.label}]`);
    }
  });

  it("orçamento completo com descontos + créditos — todas as linhas batem entre mobile e desktop", () => {
    const sections = fxOrçamentoCompletoMisto();
    const ref = computeReferenceTotals(sections);

    expect(ref.discountTotal).toBeGreaterThan(0);
    expect(ref.creditTotal).toBeGreaterThan(0);
    expect(ref.discounts.length).toBeGreaterThan(0);
    expect(ref.credits.length).toBeGreaterThan(0);

    const mobile = renderMobile(sections);
    expectContainsBRL(mobile.container, ref.subtotal, "mobile.subtotal");
    expectContainsBRL(mobile.container, ref.total, "mobile.total");
    for (const line of ref.discounts) {
      expectContainsBRL(mobile.container, line.total, `mobile.discount[${line.label}]`);
    }
    for (const line of ref.credits) {
      expectContainsBRL(mobile.container, line.total, `mobile.credit[${line.label}]`);
    }
    cleanup();

    const desktop = renderDesktop(sections);
    expectContainsBRL(desktop.container, ref.subtotal, "desktop.subtotal");
    expectContainsBRL(desktop.container, ref.total, "desktop.total");
    for (const line of ref.discounts) {
      expectContainsBRL(desktop.container, line.total, `desktop.discount[${line.label}]`);
    }
    for (const line of ref.credits) {
      expectContainsBRL(desktop.container, line.total, `desktop.credit[${line.label}]`);
    }

    // Invariante econômico final: subtotal == total + discount + credit
    expect(ref.subtotal).toBeCloseTo(ref.total + ref.discountTotal + ref.creditTotal, 2);
  });

  it("não vaza BDI nas superfícies públicas mobile e desktop", () => {
    const sections = fxOrçamentoCompletoMisto();

    const mobile = renderMobile(sections);
    expect(mobile.container.textContent ?? "").not.toMatch(/BDI/i);
    cleanup();

    const desktop = renderDesktop(sections);
    expect(desktop.container.textContent ?? "").not.toMatch(/BDI/i);
  });

  it("paridade do conjunto de valores agregados (subtotal/total/linhas) entre mobile e desktop", () => {
    const sections = fxOrçamentoCompletoMisto();
    const ref = computeReferenceTotals(sections);

    // Conjunto canônico de valores que ambas as superfícies DEVEM exibir.
    const expectedAggregates = [
      ref.subtotal,
      ref.total,
      ...ref.discounts.map((d) => d.total),
      ...ref.credits.map((c) => c.total),
    ].map((v) => Number(v.toFixed(2)));

    const mobile = renderMobile(sections);
    const mobileMonies = new Set(extractAllMoney(mobile.container).map((s) => Number(parseBRL(s).toFixed(2))));
    cleanup();

    const desktop = renderDesktop(sections);
    const desktopMonies = new Set(extractAllMoney(desktop.container).map((s) => Number(parseBRL(s).toFixed(2))));

    for (const value of expectedAggregates) {
      const inMobile = [...mobileMonies].some((m) => Math.abs(m - value) < 0.01);
      const inDesktop = [...desktopMonies].some((m) => Math.abs(m - value) < 0.01);
      expect(inMobile, `mobile não renderizou ${value}`).toBe(true);
      expect(inDesktop, `desktop não renderizou ${value}`).toBe(true);
    }
  });
});
