import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, toErrorPayload } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function validate(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const str = (k: string) => typeof body[k] === "string" ? (body[k] as string).trim() : "";

  if (!str("nome_completo") || str("nome_completo").length > 255) errors.push("nome_completo inválido");
  if (!str("cpf") || !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(str("cpf"))) errors.push("CPF inválido");
  if (!str("rg")) errors.push("RG obrigatório");
  if (!str("endereco") || str("endereco").length > 500) errors.push("Endereço obrigatório");
  if (!str("email") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str("email")) || str("email").length > 255) errors.push("Email inválido");
  if (!str("unidade")) errors.push("Unidade obrigatória");
  if (!str("empreendimento") || str("empreendimento").length > 300) errors.push("Empreendimento obrigatório");
  if (!str("endereco_imovel") || str("endereco_imovel").length > 500) errors.push("Endereço do imóvel obrigatório");
  if (!str("budget_id")) errors.push("budget_id obrigatório");

  const parcelas = Number(body.parcelas);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 18) errors.push("Parcelas inválidas (1-18)");

  return errors;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const errors = validate(body);
    if (errors.length > 0) {
      return new Response(JSON.stringify({ error: "Validação falhou", details: errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const budgetId = (body.budget_id as string).trim();

    // Verify budget exists and is in a valid state
    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .select("id, status, public_id, project_name")
      .eq("id", budgetId)
      .single();

    if (budgetError || !budget) {
      return new Response(JSON.stringify({ error: "Orçamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (budget.status !== "published") {
      return new Response(JSON.stringify({ error: "Orçamento não está publicado" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    await supabase.from("budgets").update({
      status: "minuta_solicitada",
      lead_name: (body.nome_completo as string).trim().substring(0, 255),
      lead_email: (body.email as string).trim().substring(0, 255),
    }).eq("id", budgetId);

    return new Response(JSON.stringify({ success: true, project_name: budget.project_name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[validate-contract-request]", toErrorPayload(error));
    return errorResponse(error, 500, corsHeaders);
  }
});
