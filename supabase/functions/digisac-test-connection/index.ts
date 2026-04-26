// Testa a conexão com Digisac chamando GET /me/tokens (ou /me como fallback).
// Auth: verify_jwt = true.

import {
  CORS_HEADERS,
  digisacFetch,
  jsonResponse,
  loadDigisacConfig,
  makeServiceClient,
} from "../_shared/digisac.ts";
import { authorizeRequest } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const auth = await authorizeRequest(req, { corsHeaders: CORS_HEADERS });
  if (!auth.ok) return auth.response;

  const supabase = makeServiceClient();
  const cfg = await loadDigisacConfig(supabase);

  if (!cfg.enabled) {
    return jsonResponse({ ok: false, error: "Integração desabilitada." }, 200);
  }
  if (!cfg.apiToken) {
    return jsonResponse(
      { ok: false, error: "API Token não configurado." },
      200,
    );
  }

  // Tenta endpoints comuns para validar token.
  const candidates = ["/me/tokens", "/me", "/users/me"];
  for (const path of candidates) {
    try {
      const resp = await digisacFetch<Record<string, unknown>>(cfg, path);
      return jsonResponse({
        ok: true,
        endpoint: path,
        message: `Conectado em ${cfg.apiBaseUrl}`,
        data: resp,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Se for 404, tenta o próximo. Se for 401/403, retorna imediatamente.
      if (msg.includes(" 401 ") || msg.includes(" 403 ")) {
        return jsonResponse({
          ok: false,
          error: `Token rejeitado pela API Digisac: ${msg}`,
        });
      }
      console.warn(`[digisac-test-connection] ${path} falhou:`, msg);
    }
  }

  return jsonResponse({
    ok: false,
    error: "Nenhum endpoint de validação respondeu. Verifique a URL base e o token.",
  });
});
