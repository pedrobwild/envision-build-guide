import { describe, it, expect } from "vitest";
import { parseItemDescription, isDescriptionExpandable } from "../parse-item-description";

describe("parseItemDescription", () => {
  it("retorna null para input vazio/null/undefined", () => {
    expect(parseItemDescription(null)).toBeNull();
    expect(parseItemDescription(undefined)).toBeNull();
    expect(parseItemDescription("")).toBeNull();
    expect(parseItemDescription("   ")).toBeNull();
  });

  it("retorna null para descrições curtas sem ';'", () => {
    expect(parseItemDescription("Texto curto")).toBeNull();
    expect(parseItemDescription("Apenas uma frase pequena sem ponto e vírgula.")).toBeNull();
  });

  it("descrições longas sem rooms voltam como flat bullets se houver ';'", () => {
    const desc = "primeiro item com bastante texto; segundo item também grande; terceiro item descritivo";
    const result = parseItemDescription(desc);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].room).toBeNull();
    expect(result![0].items.length).toBeGreaterThanOrEqual(2);
  });

  it("descrição longa sem ';' e sem room retorna parágrafo único", () => {
    const longText = "a".repeat(120);
    const result = parseItemDescription(longText);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].room).toBeNull();
    expect(result![0].items).toHaveLength(1);
  });

  it("agrupa por cômodo quando o texto cita rooms conhecidos", () => {
    const desc =
      "Banheiro A. 01 Balcão em mármore com cuba dupla; B. 01 Nicho embutido para acessórios. " +
      "Cozinha A. 01 Nicho aéreo para temperos; B. 01 Bancada em quartzo com cooktop integrado";
    const result = parseItemDescription(desc);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(2);
    const rooms = result!.map((g) => g.room);
    expect(rooms).toContain("Banheiro");
    expect(rooms).toContain("Cozinha");
  });

  it("remove códigos 'A. 01' / 'B. 02' do início dos itens", () => {
    const desc =
      "Cozinha A. 01 Bancada em quartzo de altíssima qualidade; B. 02 Armário aéreo planejado em MDF branco";
    const result = parseItemDescription(desc);
    const cozinha = result!.find((g) => g.room === "Cozinha")!;
    expect(cozinha.items[0]).not.toMatch(/^[A-Z]\.\s*\d+/);
    expect(cozinha.items[0]).toContain("Bancada");
  });

  it("substitui 'contendo' por 'com' nos itens", () => {
    const desc =
      "Cozinha A. 01 Armário contendo prateleiras internas e iluminação; B. 02 Outro item descrito com detalhe.";
    const result = parseItemDescription(desc);
    const cozinha = result!.find((g) => g.room === "Cozinha")!;
    expect(cozinha.items.some((i) => /\bcom\b/i.test(i))).toBe(true);
    expect(cozinha.items.some((i) => /\bcontendo\b/i.test(i))).toBe(false);
  });

  it("filtra itens vazios ou muito curtos (<=3 chars)", () => {
    const desc =
      "Banheiro A. 01 Bancada principal extensa em mármore branco; ; aa; B. 02 Outro item descrito;";
    const result = parseItemDescription(desc);
    const banheiro = result!.find((g) => g.room === "Banheiro")!;
    expect(banheiro.items.every((i) => i.length > 3)).toBe(true);
  });

  it("descrição com ';' suficiente vira flat bullets quando não tem room", () => {
    const desc = "primeiro pedaço descritivo; segundo pedaço descritivo; terceiro pedaço descritivo";
    const result = parseItemDescription(desc);
    expect(result![0].room).toBeNull();
    expect(result![0].items).toHaveLength(3);
  });
});

describe("isDescriptionExpandable", () => {
  it("false para vazio/null", () => {
    expect(isDescriptionExpandable(null)).toBe(false);
    expect(isDescriptionExpandable(undefined)).toBe(false);
    expect(isDescriptionExpandable("")).toBe(false);
  });

  it("true para texto com >= 80 chars", () => {
    expect(isDescriptionExpandable("a".repeat(80))).toBe(true);
    expect(isDescriptionExpandable("a".repeat(200))).toBe(true);
  });

  it("true para texto com ';' (mesmo curto)", () => {
    expect(isDescriptionExpandable("um; dois")).toBe(true);
  });

  it("false para texto curto sem ';'", () => {
    expect(isDescriptionExpandable("texto pequeno")).toBe(false);
  });
});
