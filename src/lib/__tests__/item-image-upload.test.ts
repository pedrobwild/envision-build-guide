import { describe, it, expect } from "vitest";
import {
  validateItemImageFile,
  MAX_ITEM_IMAGE_BYTES,
  buildItemImagePath,
} from "../item-image-upload";

function makeFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

describe("validateItemImageFile", () => {
  it("aceita JPEG válido", () => {
    const r = validateItemImageFile(makeFile("foto.jpg", "image/jpeg"));
    expect(r).toEqual({ ok: true, ext: "jpg" });
  });

  it("aceita PNG sem MIME válido baseando-se na extensão", () => {
    const r = validateItemImageFile(makeFile("foto.PNG", ""));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ext).toBe("png");
  });

  it("rejeita PDF (formato inválido)", () => {
    const r = validateItemImageFile(makeFile("doc.pdf", "application/pdf"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("format");
  });

  it("rejeita arquivo maior que o limite", () => {
    const big = makeFile("grande.jpg", "image/jpeg", MAX_ITEM_IMAGE_BYTES + 1);
    const r = validateItemImageFile(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("size");
  });

  it("rejeita arquivo vazio", () => {
    const r = validateItemImageFile(makeFile("vazio.jpg", "image/jpeg", 0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty");
  });

  it("usa extensão derivada do MIME quando o nome não tem extensão", () => {
    const r = validateItemImageFile(makeFile("colado", "image/png"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ext).toBe("png");
  });
});

describe("buildItemImagePath", () => {
  it("inclui o budgetId, pasta items e a extensão informada", () => {
    const path = buildItemImagePath("budget-1", "jpg");
    expect(path.startsWith("budget-1/items/")).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
  });
});
