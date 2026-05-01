/**
 * Testes do PrazoExecucaoChip.
 *
 * Garantem o comportamento de UX combinado com Pedro:
 *  - empty state: botão "+ Definir prazo de execução"
 *  - clique no chip preenchido entra em modo edição
 *  - Enter / blur salvam; Escape cancela
 *  - input vazio limpa (null); valores inválidos são rejeitados
 *  - readOnly esconde o estado vazio e desabilita edição
 *  - exibe aproximação de semanas (5d = 1 sem, arredonda pra cima)
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { PrazoExecucaoChip } from "../PrazoExecucaoChip";

function Harness({
  initial,
  readOnly,
}: {
  initial: number | null;
  readOnly?: boolean;
}) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <div>
      <PrazoExecucaoChip value={v} onChange={setV} readOnly={readOnly} />
      <span data-testid="value">{v == null ? "null" : String(v)}</span>
    </div>
  );
}

describe("PrazoExecucaoChip", () => {
  it("mostra botão '+ Definir prazo de execução' quando não há valor", () => {
    const { getByRole } = render(<Harness initial={null} />);
    const btn = getByRole("button");
    expect(btn.textContent).toMatch(/Definir prazo de execução/);
  });

  it("mostra chip com dias úteis e aproximação de semanas quando há valor", () => {
    const { getByRole } = render(<Harness initial={30} />);
    const chip = getByRole("button");
    // 30 dias = 6 semanas
    expect(chip.textContent).toMatch(/30/);
    expect(chip.textContent).toMatch(/dias úteis/);
    expect(chip.textContent).toMatch(/≈ 6 sem/);
  });

  it("arredonda semanas para cima (7 dias = 2 sem)", () => {
    const { getByRole } = render(<Harness initial={7} />);
    expect(getByRole("button").textContent).toMatch(/≈ 2 sem/);
  });

  it("entra em modo edição ao clicar e salva ao pressionar Enter", () => {
    const { getByRole, getByTestId, getByLabelText } = render(
      <Harness initial={null} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByTestId("value").textContent).toBe("45");
  });

  it("salva ao perder o foco (blur)", () => {
    const { getByRole, getByLabelText, getByTestId } = render(
      <Harness initial={10} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.blur(input);
    expect(getByTestId("value").textContent).toBe("20");
  });

  it("Escape cancela sem alterar o valor", () => {
    const { getByRole, getByLabelText, getByTestId } = render(
      <Harness initial={15} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(getByTestId("value").textContent).toBe("15");
  });

  it("input vazio limpa o valor (null)", () => {
    const { getByRole, getByLabelText, getByTestId } = render(
      <Harness initial={30} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByTestId("value").textContent).toBe("null");
  });

  it("rejeita valores não-inteiros e negativos sem chamar onChange", () => {
    const onChange = vi.fn();
    const { getByRole, getByLabelText } = render(
      <PrazoExecucaoChip value={10} onChange={onChange} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(getByRole("button"));
    const input2 = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "3.5" } });
    fireEvent.keyDown(input2, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("não chama onChange quando o valor não muda", () => {
    const onChange = vi.fn();
    const { getByRole, getByLabelText } = render(
      <PrazoExecucaoChip value={30} onChange={onChange} />,
    );
    fireEvent.click(getByRole("button"));
    const input = getByLabelText("Dias úteis de execução da obra") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("readOnly esconde o estado vazio", () => {
    const { container } = render(<Harness initial={null} readOnly />);
    expect(container.textContent).toBe("null");
  });

  it("readOnly mostra o valor mas não permite editar", () => {
    const { container, queryByRole } = render(<Harness initial={20} readOnly />);
    expect(container.textContent).toMatch(/20/);
    // Sem button: é um span estático
    expect(queryByRole("button")).toBeNull();
  });
});
