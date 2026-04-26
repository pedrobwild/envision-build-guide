import {
  assert,
  assertEquals,
  assertNotStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toArrayBuffer } from "./bytes.ts";

Deno.test("toArrayBuffer: Uint8Array round-trips bytes", () => {
  const src = new Uint8Array([1, 2, 3, 4, 5]);
  const ab = toArrayBuffer(src);
  assert(ab instanceof ArrayBuffer);
  assertEquals(ab.byteLength, 5);
  assertEquals(Array.from(new Uint8Array(ab)), [1, 2, 3, 4, 5]);
});

Deno.test("toArrayBuffer: respects byteOffset and byteLength", () => {
  const parent = new Uint8Array([10, 20, 30, 40, 50, 60]);
  // View starting at offset 2, length 3 → [30, 40, 50]
  const view = new Uint8Array(parent.buffer, 2, 3);
  const ab = toArrayBuffer(view);
  assertEquals(ab.byteLength, 3);
  assertEquals(Array.from(new Uint8Array(ab)), [30, 40, 50]);
});

Deno.test("toArrayBuffer: copies, does not alias source buffer", () => {
  const src = new Uint8Array([7, 8, 9]);
  const ab = toArrayBuffer(src);
  // Mutate source after conversion — output must be unaffected.
  src[0] = 99;
  assertEquals(Array.from(new Uint8Array(ab)), [7, 8, 9]);
  assertNotStrictEquals(ab, src.buffer);
});

Deno.test("toArrayBuffer: works with Uint16Array (multi-byte typed array)", () => {
  const src = new Uint16Array([0x0102, 0x0304]);
  const ab = toArrayBuffer(src);
  assertEquals(ab.byteLength, 4);
  // Read back as Uint16 to verify integrity (endianness preserved)
  const view = new Uint16Array(ab);
  assertEquals(view[0], 0x0102);
  assertEquals(view[1], 0x0304);
});

Deno.test("toArrayBuffer: works with Float32Array", () => {
  const src = new Float32Array([1.5, -2.25, 3.125]);
  const ab = toArrayBuffer(src);
  assertEquals(ab.byteLength, 12);
  const view = new Float32Array(ab);
  assertEquals(Array.from(view), [1.5, -2.25, 3.125]);
});

Deno.test("toArrayBuffer: works with DataView", () => {
  const parent = new Uint8Array([1, 2, 3, 4]).buffer;
  const dv = new DataView(parent, 1, 2);
  const ab = toArrayBuffer(dv);
  assertEquals(ab.byteLength, 2);
  assertEquals(Array.from(new Uint8Array(ab)), [2, 3]);
});

Deno.test("toArrayBuffer: works with raw ArrayBuffer (returns a copy)", () => {
  const src = new Uint8Array([1, 2, 3]).buffer;
  const ab = toArrayBuffer(src);
  assert(ab instanceof ArrayBuffer);
  assertEquals(ab.byteLength, 3);
  assertEquals(Array.from(new Uint8Array(ab)), [1, 2, 3]);
  assertNotStrictEquals(ab, src);
});

Deno.test("toArrayBuffer: handles empty Uint8Array", () => {
  const ab = toArrayBuffer(new Uint8Array(0));
  assertEquals(ab.byteLength, 0);
});

Deno.test("toArrayBuffer: output is plain ArrayBuffer, never SharedArrayBuffer", () => {
  const src = new Uint8Array([1, 2, 3]);
  const ab = toArrayBuffer(src);
  // Strict instanceof check — guards against the TS2322 case mammoth hits.
  assertEquals(ab.constructor.name, "ArrayBuffer");
});
