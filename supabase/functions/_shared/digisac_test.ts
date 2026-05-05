import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BW_MARKER_REGEX, parseBwMarker } from "./digisac.ts";

Deno.test("BW_MARKER_REGEX: match básico", () => {
  const m = "[BW-1-2-3]".match(BW_MARKER_REGEX);
  assertEquals(m?.[1], "1");
  assertEquals(m?.[2], "2");
  assertEquals(m?.[3], "3");
});

Deno.test("parseBwMarker: extrai IDs grandes", () => {
  const r = parseBwMarker("Olá, vim do anúncio [BW-120208123456-120209789-120210555] obrigado");
  assertEquals(r, {
    ad_id: "120208123456",
    adset_id: "120209789",
    campaign_id: "120210555",
  });
});

Deno.test("parseBwMarker: nulo/vazio", () => {
  assertEquals(parseBwMarker(null), null);
  assertEquals(parseBwMarker(undefined), null);
  assertEquals(parseBwMarker(""), null);
});

Deno.test("parseBwMarker: rejeita não-numéricos e formatos quebrados", () => {
  assertEquals(parseBwMarker("[BW-abc-def-ghi]"), null);
  assertEquals(parseBwMarker("[BW-1-2]"), null);
  assertEquals(parseBwMarker("BW-1-2-3"), null);
  assertEquals(parseBwMarker("texto sem marcador"), null);
});

Deno.test("parseBwMarker: pega o primeiro match quando múltiplos", () => {
  const r = parseBwMarker("[BW-1-2-3] e depois [BW-4-5-6]");
  assertEquals(r, { ad_id: "1", adset_id: "2", campaign_id: "3" });
});
