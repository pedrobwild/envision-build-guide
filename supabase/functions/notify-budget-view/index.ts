import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, toErrorPayload } from "../_shared/errors.ts";

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
    const body = await req.json();
    const { budget_id, public_id, type } = body;

    if (!budget_id && !public_id) {
      return new Response(JSON.stringify({ error: "Missing budget_id or public_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Handle optional item selection notification ──
    if (type === "optional_selection") {
      const { client_name, selected_sections, selected_total } = body;

      // Get budget info
      const { data: budget, error: budgetError } = await supabase
        .from("budgets")
        .select("id, project_name, client_name, created_by")
        .eq("id", budget_id)
        .single();

      if (budgetError || !budget) {
        return new Response(JSON.stringify({ error: "Budget not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sectionsList = (selected_sections || []).join(", ");
      const totalFormatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(selected_total || 0);

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: budget.created_by,
        budget_id: budget.id,
        type: "optional_selection",
        title: "Itens opcionais selecionados!",
        message: `${client_name || budget.client_name || "Cliente"} selecionou itens opcionais no orçamento "${budget.project_name}": ${sectionsList} (${totalFormatted}).`,
      });

      // Try sending email
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && budget.created_by) {
        const { data: userData } = await supabase.auth.admin.getUserById(budget.created_by);
        const userEmail = userData?.user?.email;
        if (userEmail) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM_EMAIL") || "Bwild <onboarding@resend.dev>",
              to: [userEmail],
              subject: `🛒 ${client_name || "Cliente"} selecionou opcionais no orçamento`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
                  <h2 style="color: #1a1a1a; margin-bottom: 8px;">Itens opcionais selecionados! 🛒</h2>
                  <p style="color: #666; line-height: 1.6;">
                    <strong>${client_name || budget.client_name || ""}</strong> selecionou itens opcionais no orçamento
                    <strong>"${budget.project_name}"</strong>:
                  </p>
                  <ul style="color: #333; line-height: 1.8;">${(selected_sections || []).map((s: string) => `<li>${s}</li>`).join("")}</ul>
                  <p style="color: #1a1a1a; font-weight: bold; font-size: 16px; margin-top: 16px;">
                    Adicional: ${totalFormatted}
                  </p>
                  <p style="color: #999; font-size: 13px; margin-top: 24px;">— Bwild Budget</p>
                </div>
              `,
            }),
          }).catch((e) => console.error("Resend error:", e));
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Original first-view notification ──
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

    if (budget.view_count > 1) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_first_view" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("notifications").insert({
      user_id: budget.created_by,
      budget_id: budget.id,
      type: "budget_first_view",
      title: "Orçamento visualizado!",
      message: `O cliente ${budget.client_name || ""} abriu o orçamento "${budget.project_name}" pela primeira vez.`,
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && budget.created_by) {
      const { data: userData } = await supabase.auth.admin.getUserById(budget.created_by);
      const userEmail = userData?.user?.email;
      if (userEmail) {
        await fetch("https://api.resend.com/emails", {
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
                <p style="color: #999; font-size: 13px; margin-top: 24px;">— Bwild Budget</p>
              </div>
            `,
          }),
        }).catch((e) => console.error("Resend error:", e));
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-budget-view]", toErrorPayload(error));
    return errorResponse(error, 500, corsHeaders);
  }
});
