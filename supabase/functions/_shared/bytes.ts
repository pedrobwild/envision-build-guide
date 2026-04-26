/**
 * Safely converts any ArrayBufferView (Uint8Array, DataView, etc.) or
 * ArrayBufferLike into a fresh, non-shared ArrayBuffer.
 *
 * Required when interfacing with libraries (e.g. mammoth) whose typings demand
 * a strict `ArrayBuffer` rather than the wider `ArrayBufferLike` exposed by
 * `TypedArray.buffer` (which may be a `SharedArrayBuffer`).
 *
 * The result respects `byteOffset` / `byteLength` of the source view and never
 * leaks bytes outside the requested window.
 */
export function toArrayBuffer(input: ArrayBufferView | ArrayBufferLike): ArrayBuffer {
  if (!ArrayBuffer.isView(input)) {
    const src = new Uint8Array(input as ArrayBufferLike);
    const out = new ArrayBuffer(src.byteLength);
    new Uint8Array(out).set(src);
    return out;
  }
  const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
