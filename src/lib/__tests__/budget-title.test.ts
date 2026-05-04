import { describe, it, expect } from "vitest";
import { composeBudgetTitle } from "../budget-title";

describe("composeBudgetTitle", () => {
  it("retorna o único valor presente quando o outro está vazio", () => {
    expect(composeBudgetTitle("Projeto X", "")).toBe("Projeto X");
    expect(composeBudgetTitle(null, "Cliente Y")).toBe("Cliente Y");
    expect(composeBudgetTitle(null, null)).toBe("");
  });

  it("não duplica quando diferem apenas por espaços extras", () => {
    const proj = "Denise Kanashiro  · The Collection Paulista";
    const client = "Denise Kanashiro · The Collection Paulista";
    expect(composeBudgetTitle(proj, client)).toBe(proj);
  });

  it("não duplica quando diferem por pontuação (·, -, |)", () => {
    expect(
      composeBudgetTitle("Ana Souza - Vila Mariana", "Ana Souza · Vila Mariana"),
    ).toBe("Ana Souza - Vila Mariana");
    expect(
      composeBudgetTitle("Ana Souza | Vila Mariana", "Ana Souza Vila Mariana"),
    ).toBe("Ana Souza | Vila Mariana");
  });

  it("não duplica quando diferem por acentuação", () => {
    expect(
      composeBudgetTitle("João Silva · Jardim América", "Joao Silva Jardim America"),
    ).toBe("João Silva · Jardim América");
  });

  it("usa o valor mais completo quando um contém o outro", () => {
    expect(
      composeBudgetTitle("Mauro Kanashiro · The Collection Paulista", "Mauro Kanashiro"),
    ).toBe("Mauro Kanashiro · The Collection Paulista");
    expect(
      composeBudgetTitle("Denise Kanashiro", "Denise Kanashiro · The Collection Paulista"),
    ).toBe("Denise Kanashiro · The Collection Paulista");
  });

  it("concatena com ' · ' quando os valores são realmente distintos", () => {
    expect(composeBudgetTitle("Reforma Cobertura", "Carlos Lima")).toBe(
      "Reforma Cobertura · Carlos Lima",
    );
  });

  it("é case-insensitive na comparação", () => {
    expect(composeBudgetTitle("DENISE KANASHIRO", "denise kanashiro")).toBe(
      "DENISE KANASHIRO",
    );
  });
});
