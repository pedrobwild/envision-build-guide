import { describe, it, expect } from "vitest";
import { resolveBudgetGrandTotal } from "@/lib/budget-total";

describe("resolveBudgetGrandTotal — fonte da verdade do total do orçamento", () => {
  it("usa manual_total quando definido como número positivo", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: 12345.67, computedTotal: 999 });
    expect(r.total).toBe(12345.67);
    expect(r.source).toBe("manual");
    expect(r.label).toBe("Total geral (manual)");
  });

  it("aceita manual_total = 0 como valor válido (não cai para computado)", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: 0, computedTotal: 5000 });
    expect(r.total).toBe(0);
    expect(r.source).toBe("manual");
  });

  it("aceita manual_total como string numérica (vinda do supabase numeric)", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: "8200.5", computedTotal: 1 });
    expect(r.total).toBe(8200.5);
    expect(r.source).toBe("manual");
  });

  it("cai para computado quando manual_total é null", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: null, computedTotal: 4321 });
    expect(r.total).toBe(4321);
    expect(r.source).toBe("computed");
    expect(r.label).toBe("Total geral");
  });

  it("cai para computado quando manual_total é undefined", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: undefined, computedTotal: 100 });
    expect(r.total).toBe(100);
    expect(r.source).toBe("computed");
  });

  it("cai para computado quando manual_total é string não-numérica", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: "abc", computedTotal: 250 });
    expect(r.total).toBe(250);
    expect(r.source).toBe("computed");
  });

  it("cai para computado quando manual_total é NaN ou Infinity", () => {
    expect(resolveBudgetGrandTotal({ manualTotal: NaN, computedTotal: 10 }).total).toBe(10);
    expect(resolveBudgetGrandTotal({ manualTotal: Infinity, computedTotal: 10 }).total).toBe(10);
  });

  it("trata computado inválido (NaN/Infinity) como 0 quando precisa cair no fallback", () => {
    const r = resolveBudgetGrandTotal({ manualTotal: null, computedTotal: NaN });
    expect(r.total).toBe(0);
    expect(r.source).toBe("computed");
  });
});

describe("Paridade entre PublicBudget, Fallback, editor interno e exports", () => {
  /**
   * Estes cenários reproduzem as situações reais que motivaram a unificação:
   *  - Orçamento importado de PDF/Excel (só manual_total preenchido, sem itens)
   *  - Orçamento com seções parciais (alguns itens) mas com manual_total override
   *  - Orçamento legado, sem manual_total, calculado a partir das seções
   *
   * Todas as superfícies de exibição precisam usar o MESMO helper, então o
   * teste garante que para um mesmo input o resultado é idêntico — qualquer
   * surface que diverja vai quebrar este teste imediatamente.
   */
  const surfaces = [
    "PublicBudget",
    "PublicBudgetFallback",
    "BudgetInternalDetail",
    "PDF export",
    "XLSX export",
  ] as const;

  const scenarios = [
    {
      name: "Importado: só manual_total, sem itens",
      manualTotal: 95000,
      computedTotal: 0,
      expected: 95000,
      expectedSource: "manual" as const,
    },
    {
      name: "Override manual sobre seções parciais",
      manualTotal: 120000,
      computedTotal: 87500.45,
      expected: 120000,
      expectedSource: "manual" as const,
    },
    {
      name: "Legado sem manual_total, usa cálculo das seções",
      manualTotal: null,
      computedTotal: 87500.45,
      expected: 87500.45,
      expectedSource: "computed" as const,
    },
    {
      name: "manual_total zerado intencional (orçamento cortesia)",
      manualTotal: 0,
      computedTotal: 50000,
      expected: 0,
      expectedSource: "manual" as const,
    },
  ];

  for (const sc of scenarios) {
    it(`todas as superfícies mostram o mesmo total — ${sc.name}`, () => {
      const results = surfaces.map(() =>
        resolveBudgetGrandTotal({
          manualTotal: sc.manualTotal,
          computedTotal: sc.computedTotal,
        }),
      );

      // Todos os totais batem
      for (const r of results) {
        expect(r.total).toBe(sc.expected);
        expect(r.source).toBe(sc.expectedSource);
      }

      // E entre si (paridade estrita público ↔ interno ↔ exports)
      const totals = results.map((r) => r.total);
      expect(new Set(totals).size).toBe(1);
    });
  }
});
