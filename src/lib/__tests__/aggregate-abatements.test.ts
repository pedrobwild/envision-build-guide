import { describe, it, expect } from "vitest";
import { aggregateAbatementsByLabel, type CalcSection } from "@/lib/budget-calc";

const mkItem = (title: string, unit: number, qty = 1) => ({
  title,
  qty,
  internal_unit_price: unit,
  bdi_percentage: 0,
});

describe("aggregateAbatementsByLabel", () => {
  it("agrupa créditos por rótulo case-insensitive somando valores", () => {
    const sections: CalcSection[] = [
      {
        title: "Créditos",
        items: [
          mkItem("Crédito boas-vindas", -500),
          mkItem("crédito boas-vindas", -300), // mesmo rótulo, case diferente
          mkItem("Crédito indicação", -1000),
        ],
      },
    ];
    const { credits, creditTotal, discounts, discountTotal } =
      aggregateAbatementsByLabel(sections);

    expect(creditTotal).toBe(1800);
    expect(discountTotal).toBe(0);
    expect(discounts).toHaveLength(0);
    expect(credits).toHaveLength(2);
    // ordenado por total desc
    expect(credits[0]).toEqual({ label: "Crédito indicação", total: 1000 });
    expect(credits[1].total).toBe(800); // 500 + 300
  });

  it("separa descontos e créditos em buckets distintos", () => {
    const sections: CalcSection[] = [
      { title: "Descontos", items: [mkItem("Desconto promocional", -2000)] },
      { title: "Créditos", items: [mkItem("Crédito antecipação", -500)] },
    ];
    const r = aggregateAbatementsByLabel(sections);
    expect(r.discountTotal).toBe(2000);
    expect(r.creditTotal).toBe(500);
    expect(r.discounts[0].label).toBe("Desconto promocional");
    expect(r.credits[0].label).toBe("Crédito antecipação");
  });

  it("usa fallback quando o rótulo do item está vazio", () => {
    const sections: CalcSection[] = [
      { title: "Créditos", items: [mkItem("   ", -100)] },
      { title: "Descontos", items: [mkItem("", -200)] },
    ];
    const r = aggregateAbatementsByLabel(sections);
    expect(r.credits[0].label).toBe("Crédito");
    expect(r.discounts[0].label).toBe("Desconto");
  });

  it("ignora itens com valor zero ou positivo", () => {
    const sections: CalcSection[] = [
      {
        title: "Créditos",
        items: [
          mkItem("Crédito X", -100),
          mkItem("Item positivo", 500),
          mkItem("Item zero", 0),
        ],
      },
    ];
    const r = aggregateAbatementsByLabel(sections);
    expect(r.credits).toHaveLength(1);
    expect(r.creditTotal).toBe(100);
  });

  it("não retorna valor por item — apenas o total agregado por rótulo", () => {
    const sections: CalcSection[] = [
      {
        title: "Créditos",
        items: [
          mkItem("Crédito boas-vindas", -100),
          mkItem("Crédito boas-vindas", -200),
          mkItem("Crédito boas-vindas", -50),
        ],
      },
    ];
    const r = aggregateAbatementsByLabel(sections);
    expect(r.credits).toHaveLength(1);
    expect(r.credits[0]).toEqual({ label: "Crédito boas-vindas", total: 350 });
  });
});
