// Shared byte/buffer helpers for Supabase Edge Functions.
//
// The main motivation is avoiding the TS2322 error that libraries like
// `mammoth` trigger when fed `Uint8Array#buffer`:
//
//   Type 'ArrayBufferLike' is not assignable to type 'ArrayBuffer'.
//   Type 'SharedArrayBuffer' is missing the following properties...
//
// `Uint8Array#buffer` is typed as `ArrayBufferLike` (which includes
// `SharedArrayBuffer`), but most third-party APIs only accept a real,
// non-shared `ArrayBuffer`. This helper always returns a fresh, exact-size
// `ArrayBuffer` view of the bytes, regardless of the source TypedArray.

/**
 * Convert any `ArrayBufferView` (Uint8Array, Uint16Array, Float32Array, etc.)
 * or raw `ArrayBuffer` / `SharedArrayBuffer` into a NEW, standalone
 * `ArrayBuffer` containing exactly the visible bytes.
 *
 * Guarantees:
 *  - Always returns a fresh `ArrayBuffer` (never `SharedArrayBuffer`)
 *  - Honors `byteOffset` and `byteLength` (no leaking parent buffer bytes)
 *  - Does not mutate the input
 */
export function toArrayBuffer(input: ArrayBufferView | ArrayBufferLike): ArrayBuffer {
  // Raw buffer cases
  if (input instanceof ArrayBuffer) {
    // Copy to ensure caller can't mutate ours (and to normalize length).
    const out = new ArrayBuffer(input.byteLength);
    new Uint8Array(out).set(new Uint8Array(input));
    return out;
  }

  // SharedArrayBuffer (or anything else ArrayBufferLike that isn't a view)
  if (!ArrayBuffer.isView(input)) {
    const src = new Uint8Array(input as ArrayBufferLike);
    const out = new ArrayBuffer(src.byteLength);
    new Uint8Array(out).set(src);
    return out;
  }

  // Typed array / DataView: respect offset + length
  const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
