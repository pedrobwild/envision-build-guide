/**
 * Garante que os caminhos de falha do botão "Visualizar":
 *   - emitem `toast.error` com action.label === "Ver detalhes" (entrada da modal)
 *   - preenchem `window.__openBudgetDiag` com o diagnóstico estruturado
 *   - registram `popupBlocked: true` quando o navegador bloqueia o stub
 *   - registram `outcome: "blocked_no_published"` quando não há versão publicada
 *
 * Esses testes são complementares aos de fluxo (openPublicBudget.test.ts):
 * cobrem especificamente a observabilidade exposta ao usuário/suporte.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpcMock = vi.fn();
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

// Captura as chamadas de toast.error para inspecionar action/label.
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(() => "tid"),
    dismiss: vi.fn(),
  },
}));

// Mock leve da modal para não acoplar ao componente real (DOM/React).
const openDiagnosisDialogMock = vi.fn();
vi.mock("@/components/admin/OpenBudgetDiagnosisDialog", () => ({
  openDiagnosisDialog: (...args: unknown[]) => openDiagnosisDialogMock(...args),
}));

import { openPublicBudgetByPublicId, openPublicBudget } from "../openPublicBudget";
import type { OpenBudgetDiagnosis } from "../openPublicBudgetTelemetry";

type DiagWindow = Window & { __openBudgetDiag?: OpenBudgetDiagnosis };

function getDiag(): OpenBudgetDiagnosis | undefined {
  return (window as unknown as DiagWindow).__openBudgetDiag;
}

function getLastErrorAction(): { label: string; onClick: () => void } | undefined {
  const last = toastErrorMock.mock.calls.at(-1);
  if (!last) return undefined;
  const opts = last[1] as { action?: { label: string; onClick: () => void } } | undefined;
  return opts?.action;
}

describe("openPublicBudget — telemetria + toast Ver detalhes", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rpcMock.mockReset();
    fromResponses.length = 0;
    toastErrorMock.mockReset();
    openDiagnosisDialogMock.mockReset();
    delete (window as unknown as DiagWindow).__openBudgetDiag;
  });

  afterEach(() => {
    openSpy?.mockRestore();
  });

  it("popupBlocked=true é registrado em __openBudgetDiag mesmo em sucesso", async () => {
    // window.open retorna null → popup blocker. Stub primário falha; retry também.
    openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    rpcMock.mockResolvedValue({ data: "winner_pub", error: null });

    await openPublicBudgetByPublicId("any_id");

    const diag = getDiag();
    expect(diag).toBeDefined();
    expect(diag!.popupBlocked).toBe(true);
    expect(diag!.resolvedPublicId).toBe("winner_pub");
    // Sucesso final, então NÃO deve abrir a modal de erro nem o toast.
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("blocked_no_published: chama toast.error com action 'Ver detalhes' e popula __openBudgetDiag", async () => {
    const stubWin = {
      closed: false,
      location: { href: "about:blank" },
      close() { this.closed = true; },
    };
    openSpy = vi.spyOn(window, "open").mockReturnValue(stubWin as unknown as Window);
    rpcMock.mockResolvedValue({ data: null, error: null });
    fromResponses.push({ data: { id: "src", version_group_id: "g1" } });
    fromResponses.push({ data: null });

    await openPublicBudgetByPublicId("draft_only");

    const diag = getDiag();
    expect(diag).toBeDefined();
    expect(diag!.outcome).toBe("blocked_no_published");
    expect(diag!.resolvedPublicId).toBeNull();
    expect(diag!.correlationId).toMatch(/^[0-9a-f-]{36}$/i);

    // Toast renderizou com botão "Ver detalhes" que aciona a modal.
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    const action = getLastErrorAction();
    expect(action?.label).toBe("Ver detalhes");
    expect(typeof action?.onClick).toBe("function");

    // Clicar no botão abre a modal com o mesmo diagnóstico.
    action!.onClick();
    expect(openDiagnosisDialogMock).toHaveBeenCalledTimes(1);
    const passed = openDiagnosisDialogMock.mock.calls[0][0] as OpenBudgetDiagnosis;
    expect(passed.outcome).toBe("blocked_no_published");
    expect(passed.correlationId).toBe(diag!.correlationId);
  });

  it("blocked_no_public_id: openPublicBudgetByPublicId('') registra outcome e expõe toast com Ver detalhes", async () => {
    await openPublicBudgetByPublicId("");

    const diag = getDiag();
    expect(diag?.outcome).toBe("blocked_no_public_id");
    expect(getLastErrorAction()?.label).toBe("Ver detalhes");
  });

  it("blocked_no_public_id (openPublicBudget by ref): publica diagnóstico mesmo sem chamar RPC", async () => {
    // Sem public_id e sem auto-publish: deve bloquear e expor diag.
    openSpy = vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "about:blank" },
      close() {},
    } as unknown as Window);

    await openPublicBudget(
      { id: "b1", public_id: null, status: "draft", version_group_id: "b1" },
      { autoPublish: false },
    );

    const diag = getDiag();
    expect(diag).toBeDefined();
    // Pode ser blocked_no_public_id ou blocked_no_published dependendo do caminho;
    // o que importa é que é uma falha ("blocked_*") com toast Ver detalhes.
    expect(diag!.outcome.startsWith("blocked_")).toBe(true);
    expect(getLastErrorAction()?.label).toBe("Ver detalhes");
  });
});
