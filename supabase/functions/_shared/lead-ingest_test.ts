import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizePhone } from "./lead-ingest.ts";

Deno.test("normalizePhone: null/empty", () => {
  assertEquals(normalizePhone(null), null);
  assertEquals(normalizePhone(""), null);
  assertEquals(normalizePhone("   "), null);
  assertEquals(normalizePhone("abc"), null);
});

Deno.test("normalizePhone: remove DDI 55", () => {
  assertEquals(normalizePhone("+55 11 91234-5678"), "11912345678");
  assertEquals(normalizePhone("5511912345678"), "11912345678");
});

Deno.test("normalizePhone: celular já com 11 dígitos preserva", () => {
  assertEquals(normalizePhone("11912345678"), "11912345678");
  assertEquals(normalizePhone("(11) 91234-5678"), "11912345678");
});

Deno.test("normalizePhone: celular antigo 10 dígitos injeta 9", () => {
  // terceiro dígito 6-9 (faixa de celular antigo)
  assertEquals(normalizePhone("11 8123-4567"), "11981234567");
  assertEquals(normalizePhone("1191234567"),  "11991234567");
  assertEquals(normalizePhone("13 6722-2280"), "13967222280");
  assertEquals(normalizePhone("+55 13 6722-2280"), "13967222280");
});

Deno.test("normalizePhone: fixo 10 dígitos NÃO injeta 9", () => {
  // terceiro dígito 2-5 (faixa de fixo)
  assertEquals(normalizePhone("11 3251-1000"), "1132511000");
  assertEquals(normalizePhone("11 2222-3333"), "1122223333");
  assertEquals(normalizePhone("11 4444-5555"), "1144445555");
  assertEquals(normalizePhone("11 5555-6666"), "1155556666");
});

Deno.test("normalizePhone: tamanho fora de 10/11 mantém dígitos crus", () => {
  assertEquals(normalizePhone("123"), "123");
  assertEquals(normalizePhone("99"), "99");
});
