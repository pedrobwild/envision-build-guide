import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-project-outbound
 *
 * When a budget reaches "contrato_fechado", this function sends the project
 * data to Portal BWild's sync-project-inbound edge function via HTTP POST.
 *
 * POST body:
 *   { budget_id: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PORTAL_BWILD_SUPABASE_URL = Deno.env.get("PORTAL_BWILD_SUPABASE_URL");
    const INTEGRATION_KEY = Deno.env.get("INTEGRATION_INBOUND_KEY");

    if (!PORTAL_BWILD_SUPABASE_URL) {
      throw new Error("PORTAL_BWILD_SUPABASE_URL not configured");
    }
    if (!INTEGRATION_KEY) {
      throw new Error("INTEGRATION_INBOUND_KEY not configured");
    }

    const localDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const budgetId = body.budget_id ?? body.record?.id;

    if (!budgetId) {
      return new Response(JSON.stringify({ error: "budget_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch budget ---
    const { data: budget, error: budgetErr } = await localDb
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (budgetErr || !budget) {
      throw new Error(`Budget not found: ${budgetErr?.message ?? budgetId}`);
    }

    // Only sync if contrato_fechado
    if (budget.internal_status !== "contrato_fechado") {
      return new Response(JSON.stringify({
        message: "Budget is not in contrato_fechado status, skipping",
        status: budget.internal_status,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already synced
    const { data: existingSync } = await localDb
      .from("integration_sync_log")
      .select("id, target_id")
      .eq("source_system", "envision")
      .eq("entity_type", "project")
      .eq("source_id", budgetId)
      .eq("sync_status", "success")
      .maybeSingle();

    if (existingSync?.target_id) {
      return new Response(JSON.stringify({
        message: "Project already synced",
        project_id: existingSync.target_id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sections + adjustments for value calculation
    const [{ data: sections }, { data: adjustments }] = await Promise.all([
      localDb.from("sections").select("id, title, section_price, is_optional").eq("budget_id", budgetId),
      localDb.from("adjustments").select("amount, sign").eq("budget_id", budgetId),
    ]);

    const sectionsTotal = (sections ?? [])
      .filter((s) => !s.is_optional)
      .reduce((sum, s) => sum + (s.section_price ?? 0), 0);
    const adjustmentsTotal = (adjustments ?? [])
      .reduce((sum, a) => sum + a.amount * a.sign, 0);
    const totalValue = sectionsTotal + adjustmentsTotal;

    // Build payload
    const projectPayload = mapBudgetToProject(budget, totalValue);

    // --- Call Portal BWild's sync-project-inbound ---
    const inboundUrl = `${PORTAL_BWILD_SUPABASE_URL}/functions/v1/sync-project-inbound`;

    const response = await fetch(inboundUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-integration-key": INTEGRATION_KEY,
      },
      body: JSON.stringify({
        project: projectPayload,
        source_id: budgetId,
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Portal BWild returned ${response.status}: ${responseData.error ?? response.statusText}`);
    }

    const projectId = responseData.project_id ?? null;

    // Log success
    await localDb.from("integration_sync_log").upsert({
      source_system: "envision",
      target_system: "portal_bwild",
      entity_type: "project",
      source_id: budgetId,
      target_id: projectId,
      sync_status: "success",
      payload: projectPayload,
      attempts: 1,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: "source_system,entity_type,source_id",
    });

    return new Response(JSON.stringify({
      status: "success",
      budget_id: budgetId,
      project_id: projectId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sync-project-outbound error:", error);

    // Log failure (best effort)
    try {
      const localDb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const bodyClone = await req.clone().json().catch(() => ({}));
      const budgetId = bodyClone.budget_id ?? bodyClone.record?.id;
      if (budgetId) {
        await localDb.from("integration_sync_log").upsert({
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "project",
          source_id: budgetId,
          sync_status: "failed",
          error_message: error.message,
          attempts: 1,
        }, {
          onConflict: "source_system,entity_type,source_id",
        });
      }
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Maps an Envision budget → Portal BWild project payload.
 */
function mapBudgetToProject(budget: any, totalValue: number) {
  return {
    name: budget.project_name || `Projeto ${budget.client_name}`,
    client_name: budget.client_name,
    client_phone: budget.client_phone,
    client_email: budget.lead_email,
    address: [budget.condominio, budget.bairro, budget.city]
      .filter(Boolean)
      .join(", ") || null,
    condominium: budget.condominio,
    neighborhood: budget.bairro,
    city: budget.city,
    unit: budget.unit,
    property_type: budget.property_type ?? "Apartamento",
    total_area: budget.metragem,
    estimated_duration_weeks: budget.estimated_weeks,
    budget_value: totalValue,
    budget_code: budget.sequential_code,
    status: "planning",
    notes: budget.internal_notes,
    consultora_comercial: budget.consultora_comercial,
    contract_file_url: budget.contract_file_url ?? null,
  };
}
