// Shared auth helper for Supabase Edge Functions.
//
// Provides a single, consistent way to:
//   - Build a Supabase auth client that forwards the caller's JWT, AND
//   - Authorize the caller via `auth.getUser()` (returning user + bearer JWT).
//
// Usage in a function:
//
//   import { authorizeRequest } from "../_shared/auth.ts";
//
//   const auth = await authorizeRequest(req);
//   if (!auth.ok) return auth.response; // 401 with CORS headers already set
//   const { user, jwt, client } = auth;  // user.id, user.email, etc.
//
// Notes:
//   - We use `getUser()` (not `getClaims()`) because the latter is not exposed
//     on the SupabaseAuthClient type used in this project.
//   - CORS headers are always included on the 401 response so the browser can
//     read the error from cross-origin callers.

import {
  createClient,
  type SupabaseClient,
  type User,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";

/** Permissive CORS headers used across edge functions. */
export const AUTH_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export interface AuthSuccess {
  ok: true;
  /** Authenticated user returned by Supabase Auth. */
  user: User;
  /** Raw bearer JWT extracted from the Authorization header. */
  jwt: string;
  /** Supabase client scoped to the caller's JWT (RLS applies). */
  client: SupabaseClient;
}

export interface AuthFailure {
  ok: false;
  /** Ready-to-return Response with 401 and CORS headers. */
  response: Response;
}

export type AuthResult = AuthSuccess | AuthFailure;

interface AuthorizeOptions {
  /**
   * Extra CORS headers to merge onto the 401 response (e.g. when the function
   * uses a custom CORS_HEADERS constant).
   */
  corsHeaders?: Record<string, string>;
  /** Override Supabase URL (defaults to env `SUPABASE_URL`). */
  supabaseUrl?: string;
  /** Override anon key (defaults to env `SUPABASE_ANON_KEY`). */
  anonKey?: string;
}

function unauthorized(corsHeaders: Record<string, string>): AuthFailure {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    ),
  };
}

/**
 * Validate the request's `Authorization: Bearer <jwt>` header and return the
 * authenticated user (via `auth.getUser()`).
 *
 * On failure, returns `{ ok: false, response }` where `response` is a
 * pre-built 401 with CORS headers — caller can `return auth.response` directly.
 */
export async function authorizeRequest(
  req: Request,
  opts: AuthorizeOptions = {},
): Promise<AuthResult> {
  const corsHeaders = { ...AUTH_CORS_HEADERS, ...(opts.corsHeaders ?? {}) };

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return unauthorized(corsHeaders);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return unauthorized(corsHeaders);

  const supabaseUrl = opts.supabaseUrl ?? Deno.env.get("SUPABASE_URL");
  const anonKey = opts.anonKey ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return unauthorized(corsHeaders);
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return unauthorized(corsHeaders);
  }

  return { ok: true, user: data.user, jwt, client };
}
