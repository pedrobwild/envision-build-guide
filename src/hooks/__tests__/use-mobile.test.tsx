/**
 * Garantia anti-regressão: useIsMobile deve REAGIR a redimensionamento.
 *
 * Antes desta correção, vários componentes do orçamento público lidavam com
 * mobile via `typeof window !== "undefined" && window.innerWidth < 768`,
 * avaliado uma única vez no primeiro render. Isso quebrava a UX em rotação
 * de aparelho, splits responsivos e zoom — e era especialmente nocivo no
 * `PublicBudget` (CollapsiblePhotoGroup) e no `NeighborhoodDensityMap`.
 *
 * Este teste prova que o hook reage ao evento de mudança de breakpoint.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../use-mobile";

type MqlListener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(initialWidth: number) {
  let listener: MqlListener | null = null;

  const mql: MediaQueryList = {
    matches: initialWidth < 768,
    media: "(max-width: 767px)",
    onchange: null,
    addEventListener: ((event: string, cb: MqlListener) => {
      if (event === "change") listener = cb;
    }) as MediaQueryList["addEventListener"],
    removeEventListener: ((event: string) => {
      if (event === "change") listener = null;
    }) as MediaQueryList["removeEventListener"],
    dispatchEvent: () => true,
    addListener: () => {},
    removeListener: () => {},
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: initialWidth,
  });

  return {
    triggerChange(newWidth: number) {
      (window as unknown as { innerWidth: number }).innerWidth = newWidth;
      listener?.({ matches: newWidth < 768 } as MediaQueryListEvent);
    },
  };
}

describe("useIsMobile", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("retorna true quando viewport inicial é mobile", () => {
    mockMatchMedia(420);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("retorna false quando viewport inicial é desktop", () => {
    mockMatchMedia(1440);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("reage ao redimensionar de desktop para mobile", () => {
    const { triggerChange } = mockMatchMedia(1440);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => triggerChange(380));
    expect(result.current).toBe(true);
  });

  it("reage ao redimensionar de mobile para desktop", () => {
    const { triggerChange } = mockMatchMedia(360);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => triggerChange(1280));
    expect(result.current).toBe(false);
  });
});
