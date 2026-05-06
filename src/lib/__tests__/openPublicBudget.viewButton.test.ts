/**
 * E2E-like (Vitest + jsdom) do botão "Visualizar" do card comercial.
 *
 * Cobre os dois estados visíveis no PublicLinkStatusBadge:
 *   - "Público" (published)  → openPublicBudget abre direto a URL pública
 *     correspondente ao public_id do próprio orçamento, sem consultar RPC.
 *   - "Rascunho" (draft)     → openPublicBudget consulta o grupo, encontra a
 *     versão publicada (sibling) e abre a URL pública DESSA versão — não a
 *     do draft. O toast.error não deve ser disparado.
 *
 * Estratégia: mockamos `window.open` (stub blank + navigate) e o supabase.from
 * para simular a busca de versão publicada do mesmo grupo. Assim validamos a
 * URL final que seria carregada na nova aba — equivalente comportamental ao
 * E2E real do clique em "Visualizar".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fromResponses: Array<{ data: unknown; error?: unknown }> = [];

function makeFromBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  ["select", "eq", "or", "in", "not", "order"].forEach((m) => {
    builder[m] = vi.fn(chain);
  });
  // `.limit(1)` resolve como thenable na query do fallback.
  builder.limit = vi.fn(() => {
    const next = fromResponses.shift() ?? { data: null, error: null };
    return Promise.resolve(next);
  });
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(fromResponses.shift() ?? { data: null, error: null }),
  );
  return builder;
}

const fromMock = vi.fn((_table?: string) => makeFromBuilder());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: (table: string) => fromMock(table),
  },
}));

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastErrorMock(...a),
    success: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(() => "tid"),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/components/admin/OpenBudgetDiagnosisDialog", () => ({
  openDiagnosisDialog: vi.fn(),
}));

import { openPublicBudget } from "../openPublicBudget";
import { getPublicBudgetUrl } from "../getPublicUrl";
import { derivePublicLinkStatus } from "@/components/admin/PublicLinkStatusBadge";

interface FakeWin {
  closed: boolean;
  location: { href: string };
  close: () => void;
}

function makeStubWindow(): FakeWin {
  return {
    closed: false,
    location: { href: "about:blank" },
    close() {
      this.closed = true;
    },
  };
}

describe("Botão Visualizar — abre URL pública correta por estado do badge", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let stub: FakeWin;

  beforeEach(() => {
    fromResponses.length = 0;
    fromMock.mockClear();
    toastErrorMock.mockReset();
    stub = makeStubWindow();
    openSpy = vi.spyOn(window, "open").mockImplementation(((url?: string) => {
      // Direct path passa a URL final no `window.open`; async path passa
      // "about:blank" e depois seta `stub.location.href`.
      if (url && url !== "about:blank") {
        stub.location.href = url;
      }
      return stub as unknown as Window;
    }) as typeof window.open);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('badge "Público": abre direto a URL do public_id sem consultar fallback', async () => {
    const budget = {
      id: "b-published",
      public_id: "pub_abc123",
      status: "published",
      version_group_id: "g1",
    };

    // Sanity: o badge classificaria este orçamento como "published".
    expect(derivePublicLinkStatus(budget.public_id, budget.status)).toBe("published");

    await openPublicBudget(budget);

    // Não deve ter feito fallback no banco — é o caminho síncrono direto.
    expect(fromMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();

    // Stub abre about:blank (gesto do usuário) e navega para a URL pública correta.
    expect(openSpy).toHaveBeenCalledWith(
      "about:blank",
      "_blank",
    );
    expect(stub.location.href).toBe(getPublicBudgetUrl("pub_abc123"));
  });

  it('badge "Rascunho": consulta grupo e abre URL da versão publicada (sibling)', async () => {
    const draft = {
      id: "b-draft",
      public_id: "pub_draft999", // existe mas o status é draft → badge "Rascunho"
      status: "draft",
      version_group_id: "group-xyz",
    };

    expect(derivePublicLinkStatus(draft.public_id, draft.status)).toBe("draft");

    // O fallback retorna a versão publicada vencedora do grupo.
    fromResponses.push({
      data: [
        {
          id: "b-published-sibling",
          public_id: "pub_winner_42",
          status: "published",
          version_number: 3,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    await openPublicBudget(draft);

    // Stub abre PRIMEIRO em about:blank (dentro do gesto) e depois recebe
    // a URL final via `stub.location.href`.
    expect(openSpy).toHaveBeenCalledWith(
      "about:blank",
      "_blank",
      "noopener,noreferrer",
    );
    expect(stub.location.href).toBe(getPublicBudgetUrl("pub_winner_42"));

    // E NÃO deve ter aberto a URL do próprio draft.
    expect(stub.location.href).not.toBe(getPublicBudgetUrl("pub_draft999"));

    // Sucesso: nenhum toast de erro.
    expect(toastErrorMock).not.toHaveBeenCalled();

    // Consultou a tabela budgets para localizar o sibling.
    expect(fromMock).toHaveBeenCalledWith("budgets");
  });
});
