// Diagnóstico temporário: subscribed_apps, app info, permissions do Page Access Token
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_ID = "573930492474333";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const PAGE_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN");
  const APP_SECRET = Deno.env.get("META_APP_SECRET");

  const result: Record<string, unknown> = {
    page_id: PAGE_ID,
    has_page_token: !!PAGE_TOKEN,
    has_app_secret: !!APP_SECRET,
  };

  async function call(label: string, url: string) {
    try {
      const r = await fetch(url);
      const text = await r.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* keep text */ }
      result[label] = { status: r.status, body };
    } catch (e) {
      result[label] = { error: String(e) };
    }
  }

  if (PAGE_TOKEN) {
    // 2. subscribed_apps da página
    await call(
      "subscribed_apps",
      `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps?access_token=${encodeURIComponent(PAGE_TOKEN)}`,
    );

    // 4. permissions do token de página
    await call(
      "me_permissions",
      `https://graph.facebook.com/v19.0/me/permissions?access_token=${encodeURIComponent(PAGE_TOKEN)}`,
    );

    // /me com o page token (descobre app_id e page name)
    await call(
      "me_info",
      `https://graph.facebook.com/v19.0/me?fields=id,name,category,tasks&access_token=${encodeURIComponent(PAGE_TOKEN)}`,
    );

    // debug_token: revela app_id, scopes, expiração e is_valid
    if (APP_SECRET) {
      // O parâmetro access_token do debug_token precisa ser app_token = APP_ID|APP_SECRET.
      // Mas não sabemos APP_ID ainda. Tentamos via /me?fields=... e via inspecionando o próprio token usando o page token como input + page token como access (Meta aceita user_token|user_token).
      await call(
        "debug_token_self",
        `https://graph.facebook.com/v19.0/debug_token?input_token=${encodeURIComponent(PAGE_TOKEN)}&access_token=${encodeURIComponent(PAGE_TOKEN)}`,
      );
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
