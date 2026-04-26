// Shared error helper for Supabase Edge Functions.
//
// Converts ANY thrown value (Error, PostgrestError, plain object, string,
// unknown) into a consistent `{ message, code }` shape suitable for both
// structured logging and JSON HTTP responses.
//
// Usage:
//
//   import { toErrorPayload, errorResponse } from "../_shared/errors.ts";
//
//   try { ... }
//   catch (err) {
//     const payload = toErrorPayload(err);          // { message, code? }
//     console.error("[my-fn] failed", payload);
//     return errorResponse(err, 500, corsHeaders);  // pre-built Response
//   }
//
// Why a single shape?
//   - PostgrestError has { message, code, details, hint } but no `name`,
//     so casting to `Error` is unsafe (TS2352).
//   - Generic `unknown` from `catch (err)` can be anything.
//   - Logs and clients should see the SAME normalized fields everywhere.

export interface ErrorPayload {
  /** Human-readable message; never empty (falls back to "Unknown error"). */
  message: string;
  /** Optional machine-readable code (e.g. Postgrest "23505", custom strings). */
  code?: string;
  /** Optional extra details (Postgrest hint/details, etc.). */
  details?: string;
}

interface MaybeErrorLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  error_description?: unknown;
}

function pickString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * Normalize any thrown value into `{ message, code?, details? }`.
 *
 * Handles:
 *   - `Error` (and subclasses)
 *   - `PostgrestError` ({ message, code, details, hint })
 *   - Plain objects with a `message` field
 *   - Strings
 *   - `null` / `undefined` / anything else
 */
export function toErrorPayload(err: unknown): ErrorPayload {
  if (err === null || err === undefined) {
    return { message: "Unknown error" };
  }

  if (err instanceof Error) {
    // Some Error subclasses carry a `code` (e.g. Node-style errors).
    const code = pickString((err as Error & { code?: unknown }).code);
    return code ? { message: err.message, code } : { message: err.message };
  }

  if (typeof err === "string") {
    return { message: err.length > 0 ? err : "Unknown error" };
  }

  if (typeof err === "object") {
    const e = err as MaybeErrorLike;
    const message =
      pickString(e.message) ??
      pickString(e.error_description) ??
      safeStringify(err);
    const code = pickString(e.code);
    const details = pickString(e.details) ?? pickString(e.hint);

    const payload: ErrorPayload = { message };
    if (code) payload.code = code;
    if (details) payload.details = details;
    return payload;
  }

  return { message: String(err) };
}

function safeStringify(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s && s !== "{}" ? s : "Unknown error";
  } catch {
    return "Unknown error";
  }
}

/**
 * Build a JSON `Response` from any thrown value, with consistent shape.
 * Defaults to status 500. Caller passes any CORS headers to merge in.
 */
export function errorResponse(
  err: unknown,
  status = 500,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error: toErrorPayload(err) }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
