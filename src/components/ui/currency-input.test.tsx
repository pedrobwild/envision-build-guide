import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { CurrencyInput } from "./currency-input";

function Harness({ initial = null, allowNegative = true }: { initial?: number | null; allowNegative?: boolean }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <div>
      <CurrencyInput value={v} onChange={setV} allowNegative={allowNegative} data-testid="ci" />
      <span data-testid="val">{v == null ? "null" : String(v)}</span>
    </div>
  );
}

describe("CurrencyInput", () => {
  it("formata progressivamente como moeda BRL ao digitar dígitos", () => {
    const { getByTestId } = render(<Harness />);
    const input = getByTestId("ci") as HTMLInputElement;
    // Simula digitar "30000" — input.value segue a mudança incremental do navegador
    fireEvent.change(input, { target: { value: "3" } });
    expect(input.value).toBe("R$ 0,03");
    fireEvent.change(input, { target: { value: input.value + "0" } });
    expect(input.value).toBe("R$ 0,30");
    fireEvent.change(input, { target: { value: input.value + "000" } });
    expect(input.value).toBe("R$ 300,00");
    expect(getByTestId("val").textContent).toBe("300");
  });

  it("aceita valor negativo via prefixo colado", () => {
    const { getByTestId } = render(<Harness />);
    const input = getByTestId("ci") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-R$ 3.000,00" } });
    expect(input.value).toBe("−R$ 3.000,00");
    expect(getByTestId("val").textContent).toBe("-3000");
  });

  it("permite alternar sinal pela tecla '-'", () => {
    const { getByTestId } = render(<Harness initial={1500} />);
    const input = getByTestId("ci") as HTMLInputElement;
    expect(input.value).toBe("R$ 1.500,00");
    fireEvent.keyDown(input, { key: "-" });
    expect(input.value).toBe("−R$ 1.500,00");
    expect(getByTestId("val").textContent).toBe("-1500");
    fireEvent.keyDown(input, { key: "-" });
    expect(input.value).toBe("R$ 1.500,00");
  });

  it("backspace remove o último dígito sem perder o sinal", () => {
    const { getByTestId } = render(<Harness initial={-3000} />);
    const input = getByTestId("ci") as HTMLInputElement;
    expect(input.value).toBe("−R$ 3.000,00");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input.value).toBe("−R$ 300,00");
    expect(getByTestId("val").textContent).toBe("-300");
  });

  it("delete limpa tudo (volta para null)", () => {
    const { getByTestId } = render(<Harness initial={500} />);
    const input = getByTestId("ci") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Delete" });
    expect(input.value).toBe("");
    expect(getByTestId("val").textContent).toBe("null");
  });

  it("ignora tecla '-' quando allowNegative=false", () => {
    const { getByTestId } = render(<Harness initial={1000} allowNegative={false} />);
    const input = getByTestId("ci") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "-" });
    expect(input.value).toBe("R$ 1.000,00");
  });

  it("sincroniza display quando prop value muda externamente", () => {
    function Wrap() {
      const [v, setV] = useState<number | null>(100);
      return (
        <div>
          <CurrencyInput value={v} onChange={setV} data-testid="ci" />
          <button onClick={() => setV(-2500)}>set</button>
        </div>
      );
    }
    const { getByTestId, getByText } = render(<Wrap />);
    const input = getByTestId("ci") as HTMLInputElement;
    expect(input.value).toBe("R$ 100,00");
    fireEvent.click(getByText("set"));
    expect(input.value).toBe("−R$ 2.500,00");
  });
});
