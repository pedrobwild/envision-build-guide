/**
 * useBudgetTimeMarkers — refreshKey deve disparar refetch sempre que o
 * internal_status mudar e ignorar mudanças de referência sem mudança de
 * conteúdo (evitando refetch em loop quando o caller reconstrói o valor).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { useBudgetTimeMarkers } from "@/hooks/useBudgetTimeMarkers";

const makeRow = (status: string, stageStart: string) => ({
  budget_id: "b1",
  internal_status: status,
  created_at: "2026-01-01T00:00:00Z",
  current_stage_start: stageStart,
  frozen_at: null,
  is_frozen: false,
  reference_at: "2026-05-01T00:00:00Z",
});

beforeEach(() => {
  rpcMock.mockReset();
});

describe("useBudgetTimeMarkers refreshKey", () => {
  it("refaz a busca quando o internal_status muda", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [makeRow("novo", "2026-01-01T00:00:00Z")], error: null })
      .mockResolvedValueOnce({
        data: [makeRow("in_progress", "2026-02-01T00:00:00Z")],
        error: null,
      });

    const { result, rerender } = renderHook(
      ({ status }: { status: string }) => useBudgetTimeMarkers("b1", status),
      { initialProps: { status: "novo" } },
    );

    await waitFor(() => expect(result.current.data?.internal_status).toBe("novo"));
    expect(rpcMock).toHaveBeenCalledTimes(1);

    rerender({ status: "in_progress" });
    await waitFor(() => expect(result.current.data?.internal_status).toBe("in_progress"));
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("não refaz a busca quando o refreshKey muda de referência mas não de conteúdo", async () => {
    rpcMock.mockResolvedValue({ data: [makeRow("novo", "2026-01-01T00:00:00Z")], error: null });

    const { result, rerender } = renderHook(
      ({ key }: { key: object }) => useBudgetTimeMarkers("b1", key),
      { initialProps: { key: { status: "novo" } } },
    );

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(rpcMock).toHaveBeenCalledTimes(1);

    // Novo objeto, mesmo conteúdo — não deve disparar refetch.
    rerender({ key: { status: "novo" } });
    await new Promise((r) => setTimeout(r, 10));
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("expõe refetch() para forçar nova busca após mutação", async () => {
    rpcMock.mockResolvedValue({ data: [makeRow("novo", "2026-01-01T00:00:00Z")], error: null });

    const { result } = renderHook(() => useBudgetTimeMarkers("b1", "novo"));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(rpcMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });

  it("limpa data quando budgetId vira null", async () => {
    rpcMock.mockResolvedValue({ data: [makeRow("novo", "2026-01-01T00:00:00Z")], error: null });
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useBudgetTimeMarkers(id, "novo"),
      { initialProps: { id: "b1" as string | null } },
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    rerender({ id: null });
    await waitFor(() => expect(result.current.data).toBeNull());
  });
});
