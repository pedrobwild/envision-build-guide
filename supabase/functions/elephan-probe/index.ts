// Probe call to Elephan.ia /v1/transcribes to discover response shape
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const KEY = Deno.env.get("ELEPHAN_API_KEY");
  const BASE = Deno.env.get("ELEPHAN_API_BASE_URL") ?? "https://api.elephan.dev/v1";

  const results: Record<string, unknown> = { base: BASE, has_key: !!KEY };

  // Try multiple auth header styles
  const authVariants = [
    { name: "Bearer", headers: { Authorization: `Bearer ${KEY}` } },
    { name: "x-api-key", headers: { "x-api-key": KEY ?? "" } },
    { name: "api-key", headers: { "api-key": KEY ?? "" } },
    { name: "X-Api-Token", headers: { "X-Api-Token": KEY ?? "" } },
  ];

  const paths = ["/transcribes", "/users", "/prompts"];

  for (const variant of authVariants) {
    for (const p of paths) {
      const url = `${BASE.replace(/\/$/, "")}${p}`;
      try {
        const r = await fetch(url, { headers: { ...variant.headers, Accept: "application/json" } });
        const text = await r.text();
        results[`${variant.name}_${p}`] = {
          status: r.status,
          body_preview: text.slice(0, 800),
        };
        if (r.status === 200) break;
      } catch (e) {
        results[`${variant.name}_${p}`] = { error: String(e) };
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
