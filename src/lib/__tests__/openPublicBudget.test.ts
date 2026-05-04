/**
 * Cobre o fluxo do botão "Visualizar" do card no painel comercial:
 *
 *   1. O clique abre uma janela stub SINCRONAMENTE (escapa do popup blocker
 *      do Chrome/Safari, que bloqueia window.open chamado após `await`).
 *   2. A RPC `resolve_published_public_id` é consultada para descobrir a
 *      versão publicada mais recente do mesmo grupo (cenário Dayane: o card
 *      aponta v6 mas a v7 é a publicada).
 *   3. A janela stub é navegada para a URL pública correta (v7), nunca para
 *      um draft que retornaria 404.
 *   4. Em caso de erro/timeout no RPC, navega no public_id original (graceful).
 *
 * Não usamos Playwright porque o projeto roda em Vitest + jsdom; este teste
 * de integração reproduz exatamente o caminho que o popup blocker quebrava.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock do supabase client ANTES de importar o módulo sob teste.
const rpcMock = vi.fn();
// Fila de respostas para chamadas a `supabase.from(...).maybeSingle()`,
// consumidas em ordem (camada de fallback consulta budgets duas vezes).
const fromResponses: Array<{ data: unknown; error?: unknown }> = [];
function makeFromBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  ["select", "eq", "or", "in", "not", "order"].forEach((m) => {
    builder[m] = vi.fn(chain);
  });
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(fromResponses.shift() ?? { data: null, error: null }),
  );
  return builder;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: vi.fn(() => makeFromBuilder()),
  },
}));

// Silencia toasts (importados pelo módulo).
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => "tid"),
    dismiss: vi.fn(),
  },
}));

import { openPublicBudgetByPublicId } from "../openPublicBudget";
import { getPublicBudgetUrl } from "../getPublicUrl";

interface FakeWin {
  closed: boolean;
  location: { href: string };
  close: () => void;
}

describe("openPublicBudgetByPublicId — botão Visualizar do card comercial", () => {
  let stubWin: FakeWin;
  let openSpy: ReturnType<typeof vi.spyOn>;
  let openCalls: Array<{ url: string; target: string }>;

  beforeEach(() => {
    rpcMock.mockReset();
    fromResponses.length = 0;
    openCalls = [];
    stubWin = {
      closed: false,
      location: { href: "about:blank" },
      close() { this.closed = true; },
    };
    openSpy = vi.spyOn(window, "open").mockImplementation((url, target) => {
      openCalls.push({ url: String(url ?? ""), target: String(target ?? "") });
      // Primeira chamada: stub "about:blank". Se houver fallback, retorna stub também.
      return stubWin as unknown as Window;
    });
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("abre janela stub SINCRONAMENTE no gesto do clique (antes de qualquer await)", async () => {
    // RPC nunca resolve neste tick — provamos que a janela já foi aberta.
    rpcMock.mockReturnValue(new Promise(() => {}));

    void openPublicBudgetByPublicId("dayane_v6_id");

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openCalls[0]).toEqual({
      url: "about:blank",
      target: "_blank",
    });
  });

  it("navega o stub para a versão publicada (v7) retornada pela RPC", async () => {
    rpcMock.mockResolvedValue({ data: "dayane_v7_published_id", error: null });

    await openPublicBudgetByPublicId("dayane_v6_id");

    expect(rpcMock).toHaveBeenCalledWith("resolve_published_public_id", {
      p_public_id: "dayane_v6_id",
    });
    expect(stubWin.location.href).toBe(
      getPublicBudgetUrl("dayane_v7_published_id"),
    );
    // Não tentou window.open de novo (não foi bloqueado).
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(stubWin.closed).toBe(false);
  });

  it("usa a URL apontada pelo público correto (orcamento-bwild.lovable.app/o/<id>)", async () => {
    rpcMock.mockResolvedValue({ data: "abc123", error: null });

    await openPublicBudgetByPublicId("anything");

    expect(stubWin.location.href).toBe(
      "https://orcamento-bwild.lovable.app/o/abc123",
    );
  });

  it("FALLBACK camada 2: quando RPC retorna null, busca a vencedora publicada do grupo na tabela", async () => {
    // RPC não resolve (ex: card aponta para draft órfão sem versão publicada cadastrada na RPC).
    rpcMock.mockResolvedValue({ data: null, error: null });
    // Fila: 1ª query devolve o registro fonte (com version_group_id),
    //       2ª query devolve a vencedora publicada do mesmo grupo.
    fromResponses.push({ data: { id: "src-id", version_group_id: "group-xyz" } });
    fromResponses.push({ data: { public_id: "winner_v7_pub" } });

    await openPublicBudgetByPublicId("draft_v6_id");

    expect(stubWin.location.href).toBe(getPublicBudgetUrl("winner_v7_pub"));
  });

  it("FALLBACK camada 2: também aciona quando a RPC retorna erro", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    fromResponses.push({ data: { id: "src", version_group_id: "g1" } });
    fromResponses.push({ data: { public_id: "winner_pub" } });

    await openPublicBudgetByPublicId("any_id");

    expect(stubWin.location.href).toBe(getPublicBudgetUrl("winner_pub"));
  });

  it("Sem versão publicada em lugar nenhum: fecha o stub e mostra erro (não navega para draft)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    fromResponses.push({ data: { id: "src", version_group_id: "g1" } });
    fromResponses.push({ data: null }); // nenhuma vencedora

    await openPublicBudgetByPublicId("draft_only");

    expect(stubWin.closed).toBe(true);
    expect(stubWin.location.href).toBe("about:blank");
  });

  it("Catch geral: se a RPC lança exceção, navega para o public_id original como último recurso", async () => {
    rpcMock.mockRejectedValue(new Error("network"));

    await openPublicBudgetByPublicId("original_id");

    expect(stubWin.location.href).toBe(getPublicBudgetUrl("original_id"));
  });

  it("se o popup blocker bloqueou o stub (window.open=null), tenta abrir direto após resolver", async () => {
    openSpy.mockReset();
    openCalls = [];
    openSpy.mockImplementation((url, target) => {
      openCalls.push({ url: String(url ?? ""), target: String(target ?? "") });
      // Primeira chamada (stub) bloqueada → null. Segunda (fallback) sucede.
      return openCalls.length === 1 ? null : (stubWin as unknown as Window);
    });
    rpcMock.mockResolvedValue({ data: "v7_id", error: null });

    await openPublicBudgetByPublicId("v6_id");

    expect(openCalls).toHaveLength(2);
    expect(openCalls[0].url).toBe("about:blank");
    expect(openCalls[1].url).toBe(getPublicBudgetUrl("v7_id"));
  });

  it("não chama window.open nem RPC quando publicId é vazio", async () => {
    await openPublicBudgetByPublicId("");
    expect(openSpy).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
