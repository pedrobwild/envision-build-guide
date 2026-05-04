import { describe, it, expect } from "vitest";
import { findPii, redactPii, redactDataset, containsPii } from "../pii";
import {
  assertPayloadSize,
  checkDatasetSize,
  truncateLongStrings,
  PayloadTooLargeError,
  MAX_PAYLOAD_BYTES,
} from "../payload-limits";
import { buildDataset } from "@/lib/data-analysis/buildDataset";

describe("PII detection", () => {
  it("detecta email", () => {
    const matches = findPii("Contato: jose@example.com pra falar.");
    expect(matches.find((m) => m.kind === "email")).toBeDefined();
  });

  it("detecta telefone BR", () => {
    const matches = findPii("Liga (11) 91234-5678 hoje.");
    expect(matches.find((m) => m.kind === "phone_br")).toBeDefined();
  });

  it("detecta CPF mascarado e plano", () => {
    expect(findPii("CPF 123.456.789-09").find((m) => m.kind === "cpf")).toBeDefined();
    expect(findPii("CPF 12345678909").find((m) => m.kind === "cpf")).toBeDefined();
  });

  it("detecta CNPJ", () => {
    expect(findPii("CNPJ 12.345.678/0001-90").find((m) => m.kind === "cnpj")).toBeDefined();
  });

  it("redactPii substitui por marcador", () => {
    const r = redactPii("Email jose@x.com e CPF 123.456.789-09.");
    expect(r.redacted).toContain("[REDACTED:email]");
    expect(r.redacted).toContain("[REDACTED:cpf]");
  });

  it("redactPii hash mantém últimos 4 dígitos", () => {
    const r = redactPii("CPF 12345678909.", { mode: "hash" });
    expect(r.redacted).toContain("[REDACTED:cpf:..8909]");
  });

  it("redactDataset processa todas as strings", () => {
    const rows = [
      { id: "1", note: "email@x.com" },
      { id: "2", note: "cliente sem PII" },
    ];
    const ds = buildDataset(rows, { id: "x", name: "x" });
    const out = redactDataset(ds);
    expect(out.totalRedactions).toBeGreaterThan(0);
    expect(JSON.stringify(out.dataset)).toContain("[REDACTED:email]");
  });

  it("containsPii retorna kinds amostrados", () => {
    const rows = [{ id: "1", note: "jose@x.com" }];
    const ds = buildDataset(rows, { id: "x", name: "x" });
    const r = containsPii(ds);
    expect(r.found).toBe(true);
    expect(r.sampleKinds).toContain("email");
  });
});

describe("payload limits", () => {
  it("assertPayloadSize não lança para payload pequeno", () => {
    expect(() => assertPayloadSize("a".repeat(10))).not.toThrow();
  });

  it("assertPayloadSize lança PayloadTooLargeError", () => {
    expect(() => assertPayloadSize("a".repeat(MAX_PAYLOAD_BYTES + 1))).toThrowError(
      PayloadTooLargeError,
    );
  });

  it("checkDatasetSize aceita default", () => {
    const ds = buildDataset([{ a: 1 }], { id: "x", name: "x" });
    expect(checkDatasetSize(ds).ok).toBe(true);
  });

  it("checkDatasetSize rejeita > maxRows", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ a: i }));
    const ds = buildDataset(rows, { id: "x", name: "x" });
    expect(checkDatasetSize(ds, { maxRows: 3 }).ok).toBe(false);
  });

  it("truncateLongStrings corta valores acima do limite", () => {
    const rows = [{ id: "1", note: "x".repeat(500) }];
    const ds = buildDataset(rows, { id: "x", name: "x" });
    const out = truncateLongStrings(ds, 100);
    expect(out.truncated).toBe(1);
    expect(String(out.dataset.rows[0].note).length).toBeLessThan(200);
  });
});
