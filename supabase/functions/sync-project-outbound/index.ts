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
 * data (including full budget breakdown) to Portal BWild's sync-project-inbound
 * edge function via HTTP POST.
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

    // Fetch sections, items, adjustments in parallel
    const [{ data: sections }, { data: adjustments }] = await Promise.all([
      localDb
        .from("sections")
        .select("id, title, subtitle, notes, section_price, is_optional, order_index, included_bullets, excluded_bullets, cover_image_url, tags")
        .eq("budget_id", budgetId)
        .order("order_index", { ascending: true }),
      localDb
        .from("adjustments")
        .select("id, label, amount, sign")
        .eq("budget_id", budgetId),
    ]);

    // Fetch all items for the budget's sections
    const sectionIds = (sections ?? []).map((s: any) => s.id);
    let items: any[] = [];
    if (sectionIds.length > 0) {
      const { data: itemsData } = await localDb
        .from("items")
        .select("id, section_id, title, description, qty, unit, order_index, internal_unit_price, internal_total, bdi_percentage, included_rooms, excluded_rooms, coverage_type, reference_url, notes, catalog_snapshot, catalog_item_id")
        .in("section_id", sectionIds)
        .order("order_index", { ascending: true });
      items = itemsData ?? [];
    }

    // Calculate totals
    const sectionsTotal = (sections ?? [])
      .filter((s: any) => !s.is_optional)
      .reduce((sum: number, s: any) => sum + (s.section_price ?? 0), 0);
    const adjustmentsTotal = (adjustments ?? [])
      .reduce((sum: number, a: any) => sum + a.amount * a.sign, 0);
    const totalValue = sectionsTotal + adjustmentsTotal;

    // Build payload with full budget breakdown
    const projectPayload = mapBudgetToProject(budget, totalValue);
    const budgetBreakdown = buildBudgetBreakdown(sections ?? [], items, adjustments ?? [], totalValue);

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
        budget: budgetBreakdown,
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
      payload: { ...projectPayload, budget: budgetBreakdown },
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

/**
 * Builds the full budget breakdown payload for the Portal.
 * Includes sections with their items, adjustments, and financial summary.
 */
function buildBudgetBreakdown(sections: any[], items: any[], adjustments: any[], totalValue: number) {
  // Map items by section_id
  const itemsBySection: Record<string, any[]> = {};
  for (const item of items) {
    if (!itemsBySection[item.section_id]) {
      itemsBySection[item.section_id] = [];
    }
    itemsBySection[item.section_id].push(item);
  }

  // Calculate financial summary
  let totalCost = 0;
  let totalSale = 0;

  const mappedSections = sections.map((section) => {
    const sectionItems = itemsBySection[section.id] ?? [];

    const sectionCost = sectionItems.reduce(
      (sum: number, i: any) => sum + (i.internal_total ?? (i.internal_unit_price ?? 0) * (i.qty ?? 1)),
      0
    );
    const sectionSale = section.section_price ?? 0;
    const sectionBdi = sectionCost > 0
      ? ((sectionSale - sectionCost) / sectionCost) * 100
      : 0;

    totalCost += sectionCost;
    totalSale += sectionSale;

    return {
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      notes: section.notes,
      order_index: section.order_index,
      is_optional: section.is_optional,
      section_price: sectionSale,
      cover_image_url: section.cover_image_url,
      included_bullets: section.included_bullets,
      excluded_bullets: section.excluded_bullets,
      tags: section.tags,
      cost: sectionCost,
      bdi_percentage: Math.round(sectionBdi * 10) / 10,
      item_count: sectionItems.length,
      items: sectionItems.map((item: any) => {
        const snapshot = item.catalog_snapshot ?? {};
        return {
          id: item.id,
          title: item.title,
          description: item.description,
          qty: item.qty,
          unit: item.unit,
          order_index: item.order_index,
          internal_unit_price: item.internal_unit_price,
          internal_total: item.internal_total,
          bdi_percentage: item.bdi_percentage,
          included_rooms: item.included_rooms,
          excluded_rooms: item.excluded_rooms,
          coverage_type: item.coverage_type,
          reference_url: item.reference_url,
          notes: item.notes,
          catalog_item_id: item.catalog_item_id,
          item_category: snapshot.item_category ?? null,
          supplier_id: snapshot.supplier_id ?? null,
          supplier_name: snapshot.supplier_name ?? null,
        };
      }),
    };
  });

  const avgBdi = totalCost > 0
    ? ((totalSale - totalCost) / totalCost) * 100
    : 0;

  return {
    total_value: totalValue,
    total_sale: totalSale,
    total_cost: totalCost,
    avg_bdi: Math.round(avgBdi * 10) / 10,
    net_margin: totalSale - totalCost,
    sections: mappedSections,
    adjustments: adjustments.map((a: any) => ({
      id: a.id,
      label: a.label,
      amount: a.amount,
      sign: a.sign,
    })),
  };
}
