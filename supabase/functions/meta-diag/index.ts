const corsHeaders = { "Access-Control-Allow-Origin": "*" };
const PAGE_ID = "573930492474333";
const APP_ID = "976389484883918";

Deno.serve(async () => {
  const PAGE_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN")!;
  const APP_SECRET = Deno.env.get("META_APP_SECRET")!;
  const APP_TOKEN = `${APP_ID}|${APP_SECRET}`;
  const out: Record<string, unknown> = {};

  async function call(label: string, url: string) {
    try {
      const r = await fetch(url);
      const t = await r.text();
      let b: unknown = t; try { b = JSON.parse(t); } catch {}
      out[label] = { status: r.status, body: b };
    } catch (e) { out[label] = { error: String(e) }; }
  }

  // 3. App info usando app_token
  await call("app_info",
    `https://graph.facebook.com/v19.0/${APP_ID}?fields=name,app_type,privacy_policy_url,category,link,namespace&access_token=${encodeURIComponent(APP_TOKEN)}`);

  // App subscriptions (webhook config no nível do app)
  await call("app_subscriptions",
    `https://graph.facebook.com/v19.0/${APP_ID}/subscriptions?access_token=${encodeURIComponent(APP_TOKEN)}`);

  // Tentar subscribed_apps usando app_token (alguns endpoints aceitam)
  await call("subscribed_apps_via_app_token",
    `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps?access_token=${encodeURIComponent(APP_TOKEN)}`);

  // Listar páginas que o System User tem acesso
  await call("system_user_accounts",
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(PAGE_TOKEN)}`);

  // Pegar página diretamente
  await call("page_info",
    `https://graph.facebook.com/v19.0/${PAGE_ID}?fields=id,name,access_token,tasks&access_token=${encodeURIComponent(PAGE_TOKEN)}`);

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
