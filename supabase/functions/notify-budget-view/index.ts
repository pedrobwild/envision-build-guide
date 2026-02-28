import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { budget_id, public_id } = await req.json();
    if (!budget_id && !public_id) {
      return new Response(JSON.stringify({ error: "Missing budget_id or public_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get budget info
    let query = supabase.from("budgets").select("id, project_name, client_name, created_by, view_count");
    if (budget_id) query = query.eq("id", budget_id);
    else query = query.eq("public_id", public_id);

    const { data: budget, error: budgetError } = await query.single();
    if (budgetError || !budget) {
      return new Response(JSON.stringify({ error: "Budget not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only notify on first view (view_count was 0 before increment, so now it's 1)
    if (budget.view_count > 1) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_first_view" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: budget.created_by,
      budget_id: budget.id,
      type: "budget_first_view",
      title: "Orçamento visualizado!",
      message: `O cliente ${budget.client_name || ""} abriu o orçamento "${budget.project_name}" pela primeira vez.`,
    });

    // Try sending email via Resend (optional - only if RESEND_API_KEY is configured)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && budget.created_by) {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(budget.created_by);
      const userEmail = userData?.user?.email;

      if (userEmail) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_EMAIL") || "Bwild <onboarding@resend.dev>",
            to: [userEmail],
            subject: `📊 ${budget.client_name || "Cliente"} visualizou seu orçamento`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                <h2 style="color: #1a1a1a; margin-bottom: 8px;">Seu orçamento foi visualizado! 🎉</h2>
                <p style="color: #666; line-height: 1.6;">
                  O cliente <strong>${budget.client_name || ""}</strong> acabou de abrir o orçamento
                  <strong>"${budget.project_name}"</strong> pela primeira vez.
                </p>
                <p style="color: #999; font-size: 13px; margin-top: 24px;">
                  — Bwild Budget
                </p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          console.error("Resend error:", await emailRes.text());
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
