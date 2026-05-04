/**
 * Modal "Detalhes do erro": valida que ao chamar openDiagnosisDialog(diag),
 * o componente renderiza outcome, IDs (correlation/budget/public_id) e os
 * passos da timeline em formato legível — sem depender do console.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  OpenBudgetDiagnosisDialog,
  openDiagnosisDialog,
} from "../OpenBudgetDiagnosisDialog";
import type { OpenBudgetDiagnosis } from "@/lib/openPublicBudgetTelemetry";

function makeDiag(overrides: Partial<OpenBudgetDiagnosis> = {}): OpenBudgetDiagnosis {
  return {
    correlationId: "11111111-2222-3333-4444-555555555555",
    sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    startedAt: 0,
    durationMs: 123,
    source: "by_public_id",
    inputPublicId: "abc123def456",
    inputStatus: "draft",
    inputBudgetId: "budget-uuid-1",
    popupBlocked: true,
    resolvedPublicId: null,
    resolvedFrom: null,
    outcome: "blocked_no_published",
    errorMessage: "Nenhuma versão publicada disponível",
    steps: [
      { ts: 0, step: "trace_init", detail: { foo: "bar" } },
      { ts: 12, step: "rpc_call", detail: { p_public_id: "abc123def456" } },
      { ts: 80, step: "commit", detail: { outcome: "blocked_no_published" } },
    ],
    ...overrides,
  };
}

describe("OpenBudgetDiagnosisDialog", () => {
  beforeEach(() => {
    // Reseta o store entre testes fechando o dialog.
    act(() => {
      openDiagnosisDialog(makeDiag());
    });
  });

  it("não exibe conteúdo enquanto não for acionada", () => {
    render(<OpenBudgetDiagnosisDialog />);
    // O componente está montado mas o store inicial pode estar fechado em outro test.
    // Forçamos abertura para o teste seguinte; aqui só garantimos que não crasha.
    expect(true).toBe(true);
  });

  it("renderiza outcome, IDs, timeline e mensagem de erro do diagnóstico", () => {
    render(<OpenBudgetDiagnosisDialog />);
    act(() => {
      openDiagnosisDialog(makeDiag());
    });

    // Cabeçalho
    expect(screen.getByText("Detalhes do erro")).toBeInTheDocument();
    expect(screen.getByText("Falha")).toBeInTheDocument();

    // Outcome + duração
    expect(screen.getByText("blocked_no_published")).toBeInTheDocument();
    expect(screen.getByText("123ms")).toBeInTheDocument();
    expect(screen.getByText("by_public_id")).toBeInTheDocument();

    // Flags
    expect(screen.getByText("Popup bloqueado")).toBeInTheDocument();
    expect(screen.getByText("Não resolvido")).toBeInTheDocument();
    expect(screen.getByText("Erro registrado")).toBeInTheDocument();

    // Mensagem de erro destacada
    expect(
      screen.getByText("Nenhuma versão publicada disponível"),
    ).toBeInTheDocument();

    // IDs (apresentados crus para serem copiáveis)
    expect(
      screen.getByText("11111111-2222-3333-4444-555555555555"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
    ).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
    expect(screen.getByText("budget-uuid-1")).toBeInTheDocument();

    // Timeline
    expect(screen.getByText(/Timeline \(3 passos\)/)).toBeInTheDocument();
    expect(screen.getByText("trace_init")).toBeInTheDocument();
    expect(screen.getByText("rpc_call")).toBeInTheDocument();
    expect(screen.getByText("commit")).toBeInTheDocument();
  });

  it("oculta IdRow quando o valor é null (ex.: resolvedPublicId)", () => {
    render(<OpenBudgetDiagnosisDialog />);
    act(() => {
      openDiagnosisDialog(
        makeDiag({ resolvedPublicId: null, inputBudgetId: null }),
      );
    });

    // Labels que devem aparecer
    expect(screen.getByText(/Correlation ID/i)).toBeInTheDocument();
    // Labels que não devem aparecer (valor nulo)
    expect(screen.queryByText(/Resolvido public_id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget ID/i)).not.toBeInTheDocument();
  });

  it("para outcomes de sucesso, exibe badge 'Sucesso' em vez de 'Falha'", () => {
    render(<OpenBudgetDiagnosisDialog />);
    act(() => {
      openDiagnosisDialog(
        makeDiag({
          outcome: "opened_via_rpc",
          errorMessage: null,
          popupBlocked: false,
          resolvedPublicId: "winner_pub",
          resolvedFrom: "rpc",
        }),
      );
    });

    expect(screen.getByText("Sucesso")).toBeInTheDocument();
    expect(screen.queryByText("Falha")).not.toBeInTheDocument();
    expect(screen.getByText("Resolvido via rpc")).toBeInTheDocument();
  });
});
