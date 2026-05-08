import { describe, it, expect } from "vitest";
import { extractStoragePath, extractStoragePaths } from "../storage-path";

describe("extractStoragePath", () => {
  it("retorna o path relativo ao bucket para uma URL pública válida", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/budget-assets/123/items/foo.jpg";
    expect(extractStoragePath(url, "budget-assets")).toBe("123/items/foo.jpg");
  });

  it("decodifica caracteres percent-encoded no path", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/media/pid/fotos/01-com%20espa%C3%A7o.jpg";
    expect(extractStoragePath(url, "media")).toBe("pid/fotos/01-com espaço.jpg");
  });

  it("retorna null para URL de outro bucket", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/media/pid/fotos/x.jpg";
    expect(extractStoragePath(url, "budget-assets")).toBeNull();
  });

  it("retorna null para URLs inválidas / vazias", () => {
    expect(extractStoragePath(null, "budget-assets")).toBeNull();
    expect(extractStoragePath(undefined, "budget-assets")).toBeNull();
    expect(extractStoragePath("", "budget-assets")).toBeNull();
    expect(extractStoragePath("not a url", "budget-assets")).toBeNull();
  });

  it("retorna null para URL pública sem bucket prefixo", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/";
    expect(extractStoragePath(url, "budget-assets")).toBeNull();
  });

  it("ignora query string preservando o path", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/budget-assets/abc/img.png?retry=1";
    expect(extractStoragePath(url, "budget-assets")).toBe("abc/img.png");
  });
});

describe("extractStoragePaths", () => {
  it("filtra URLs que não pertencem ao bucket", () => {
    const urls = [
      "https://abc.supabase.co/storage/v1/object/public/budget-assets/a/1.jpg",
      "https://abc.supabase.co/storage/v1/object/public/media/b/2.jpg",
      null,
      "lixo",
      "https://abc.supabase.co/storage/v1/object/public/budget-assets/a/2.jpg",
    ];
    expect(extractStoragePaths(urls, "budget-assets")).toEqual(["a/1.jpg", "a/2.jpg"]);
  });
});
