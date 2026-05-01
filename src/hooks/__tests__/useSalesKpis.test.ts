/**
 * Anti-regressão: useSalesOverview deve memoizar os bounds para que a
 * queryKey de React Query seja estável entre renders.
 *
 * Antes da correção, `useSalesOverview` chamava `rangeToBounds(period)`
 * diretamente em cada render. Para ranges relativos (`30d`, `90d`, `ytd`,
 * e `custom` sem `endDate`), `rangeToBounds` chama `new Date()` e gera
 * uma string ISO em milissegundos diferente a cada chamada — o que mudava
 * a queryKey, fazia React Query tratar como uma nova query e disparava
 * refetch contínuo da RPC `sales_kpis_dashboard`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { rangeToBounds } from "../useSalesKpis";

describe("rangeToBounds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("é now-relative para range='30d' — caller DEVE memoizar", () => {
    // Datas escolhidas tal que `now - 30d` fique depois de OPERATIONS_START
    // (2026-04-15), para que o branch que clamp para OPERATIONS_START não
    // mascare o teste.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    const a = rangeToBounds({ range: "30d" });

    vi.setSystemTime(new Date("2026-07-10T12:00:00.123Z"));
    const b = rangeToBounds({ range: "30d" });

    // Documenta o motivo da memoização em useSalesOverview:
    // o resultado depende de `Date.now()` e portanto é instável.
    expect(a.start).not.toBe(b.start);
  });

  it("é now-relative para range='custom' sem endDate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    const a = rangeToBounds({
      range: "custom",
      startDate: "2026-06-01T00:00:00.000Z",
    });

    vi.setSystemTime(new Date("2026-07-10T12:00:00.456Z"));
    const b = rangeToBounds({
      range: "custom",
      startDate: "2026-06-01T00:00:00.000Z",
    });

    expect(a.start).toBe(b.start); // start vem do parâmetro fixo
    expect(a.end).not.toBe(b.end); // end depende de "agora"
  });

  it("é determinística para range='custom' com endDate fixo", () => {
    const r1 = rangeToBounds({
      range: "custom",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-30T23:59:59.000Z",
    });
    const r2 = rangeToBounds({
      range: "custom",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-30T23:59:59.000Z",
    });
    expect(r1).toEqual(r2);
  });

  it("é determinística para range='all'", () => {
    const r1 = rangeToBounds({ range: "all" });
    const r2 = rangeToBounds({ range: "all" });
    expect(r1).toEqual(r2);
  });
});
