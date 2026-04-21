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
 *   { action: "retry_failed" }  — retry all failed project syncs
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Clone request early so body can be read again in error handler
  const reqClone = req.clone();

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

    // --- Retry failed project syncs ---
    if (body.action === "retry_failed") {
      const { data: failed } = await localDb
        .from("integration_sync_log")
        .select("source_id, attempts")
        .eq("source_system", "envision")
        .eq("entity_type", "project")
        .eq("sync_status", "failed")
        .lt("attempts", 5);

      const budgetIds = (failed ?? []).map((r: { source_id: string }) => r.source_id);
      if (budgetIds.length === 0) {
        return new Response(JSON.stringify({ message: "No failed projects to retry", results: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Array<{ id: string; status: string; error?: string }> = [];
      for (const bid of budgetIds) {
        try {
          const result = await syncSingleProject(localDb, bid, PORTAL_BWILD_SUPABASE_URL, INTEGRATION_KEY);
          results.push({ id: bid, status: "success", ...result });
        } catch (err: any) {
          results.push({ id: bid, status: "failed", error: err.message });
        }
      }
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const budgetId = body.budget_id ?? body.record?.id;

    if (!budgetId) {
      return new Response(JSON.stringify({ error: "budget_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await syncSingleProject(localDb, budgetId, PORTAL_BWILD_SUPABASE_URL, INTEGRATION_KEY);

    return new Response(JSON.stringify(result), {
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
      const bodyClone = await reqClone.json().catch(() => ({}));
      const budgetId = bodyClone.budget_id ?? bodyClone.record?.id;
      if (budgetId) {
        // Increment attempts instead of hardcoding 1
        const { data: existingLog } = await localDb
          .from("integration_sync_log")
          .select("id, attempts")
          .eq("source_system", "envision")
          .eq("entity_type", "project")
          .eq("source_id", budgetId)
          .maybeSingle();

        if (existingLog) {
          await localDb.from("integration_sync_log").update({
            sync_status: "failed",
            error_message: error.message,
            attempts: (existingLog.attempts ?? 0) + 1,
          }).eq("id", existingLog.id);
        } else {
          await localDb.from("integration_sync_log").insert({
            source_system: "envision",
            target_system: "portal_bwild",
            entity_type: "project",
            source_id: budgetId,
            sync_status: "failed",
            error_message: error.message,
            attempts: 1,
          });
        }
      }
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Syncs a single budget/project to Portal BWild.
 */
async function syncSingleProject(
  // deno-lint-ignore no-explicit-any
  localDb: any,
  budgetId: string,
  portalUrl: string,
  integrationKey: string,
) {
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
    return {
      message: "Budget is not in contrato_fechado status, skipping",
      status: budget.internal_status,
    };
  }

  // Check if already synced
  const { data: existingSync } = await localDb
    .from("integration_sync_log")
    .select("id, target_id, sync_status, attempts")
    .eq("source_system", "envision")
    .eq("entity_type", "project")
    .eq("source_id", budgetId)
    .maybeSingle();

  // Skip if already successfully synced (unless this is a retry)
  if (existingSync?.target_id && existingSync.sync_status === "success") {
    return {
      message: "Project already synced",
      project_id: existingSync.target_id,
    };
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

  // --- Fetch the rich client record (CRM data) ---
  let clientData: any = null;
  if (budget.client_id) {
    const { data: c } = await localDb
      .from("clients")
      .select(`
        id, name, email, phone, document, rg,
        nationality, marital_status, profession,
        address, address_complement, state, zip_code,
        property_address, property_address_complement,
        property_bairro, property_city, property_state, property_zip_code,
        property_metragem, property_empreendimento, property_floor_plan_url,
        city, bairro
      `)
      .eq("id", budget.client_id)
      .maybeSingle();
    clientData = c;
  }

  // --- Detailed logging for debugging ---
  console.log(`[sync-project-outbound] Budget ${budgetId} → preparing payload`);
  console.log(`[sync-project-outbound] Project: ${JSON.stringify({
    name: projectPayload.name,
    client: projectPayload.client_name,
    budget_code: projectPayload.budget_code,
    budget_value: projectPayload.budget_value,
    sections_count: budgetBreakdown.sections.length,
    items_count: budgetBreakdown.sections.reduce((s: number, sec: any) => s + sec.items.length, 0),
    adjustments_count: budgetBreakdown.adjustments.length,
    total_cost: budgetBreakdown.total_cost,
    total_sale: budgetBreakdown.total_sale,
    avg_bdi: budgetBreakdown.avg_bdi,
    has_contract: !!projectPayload.contract_file_url,
    has_client_block: !!clientData,
  })}`);

  // --- Call Portal BWild's sync-project-inbound ---
  const inboundUrl = `${portalUrl}/functions/v1/sync-project-inbound`;
  const outboundBody = {
    project: projectPayload,
    budget: budgetBreakdown,
    client: clientData ? {
      name: clientData.name,
      email: clientData.email,
      phone: clientData.phone,
      cpf: clientData.document,
      rg: clientData.rg,
      nationality: clientData.nationality,
      marital_status: clientData.marital_status,
      profession: clientData.profession,
      // Residencial
      address: clientData.address,
      address_complement: clientData.address_complement,
      city: clientData.city,
      state: clientData.state,
      zip_code: clientData.zip_code,
      // Imóvel
      property_address: clientData.property_address,
      property_address_complement: clientData.property_address_complement,
      property_bairro: clientData.property_bairro,
      property_city: clientData.property_city,
      property_state: clientData.property_state,
      property_zip_code: clientData.property_zip_code,
      property_metragem: clientData.property_metragem,
      property_empreendimento: clientData.property_empreendimento,
      property_floor_plan_url: clientData.property_floor_plan_url,
    } : null,
    source_id: budgetId,
  };

  console.log(`[sync-project-outbound] POST ${inboundUrl}`);
  console.log(`[sync-project-outbound] Integration key length: ${integrationKey.length}, prefix: ${integrationKey.substring(0, 4)}...`);
  console.log(`[sync-project-outbound] Full payload size: ${JSON.stringify(outboundBody).length} chars`);

  const response = await fetch(inboundUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-integration-key": integrationKey,
    },
    body: JSON.stringify(outboundBody),
  });

  const responseText = await response.text();
  let responseData: any = {};
  try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

  console.log(`[sync-project-outbound] Response ${response.status}: ${responseText.substring(0, 500)}`);

  if (!response.ok) {
    const errMsg = `Portal BWild returned ${response.status}: ${responseData.error ?? response.statusText}`;

    // Log failure with proper attempt increment
    const currentAttempts = existingSync?.attempts ?? 0;
    if (existingSync) {
      await localDb.from("integration_sync_log").update({
        sync_status: "failed",
        error_message: errMsg,
        attempts: currentAttempts + 1,
        payload: { ...projectPayload, budget: budgetBreakdown },
      }).eq("id", existingSync.id);
    } else {
      await localDb.from("integration_sync_log").insert({
        source_system: "envision",
        target_system: "portal_bwild",
        entity_type: "project",
        source_id: budgetId,
        sync_status: "failed",
        error_message: errMsg,
        attempts: 1,
        payload: { ...projectPayload, budget: budgetBreakdown },
      });
    }

    throw new Error(errMsg);
  }

  const projectId = responseData.project_id ?? null;
  const currentAttempts = existingSync?.attempts ?? 0;
  console.log(`[sync-project-outbound] ✅ Success! Budget ${budgetId} → Project ${projectId}`);

  // Log success
  const syncData = {
    source_system: "envision",
    target_system: "portal_bwild",
    entity_type: "project",
    source_id: budgetId,
    target_id: projectId,
    sync_status: "success",
    error_message: null,
    payload: { ...projectPayload, budget: budgetBreakdown },
    attempts: currentAttempts + 1,
    synced_at: new Date().toISOString(),
  };

  if (existingSync) {
    await localDb.from("integration_sync_log").update(syncData).eq("id", existingSync.id);
  } else {
    await localDb.from("integration_sync_log").insert(syncData);
  }

  return {
    status: "success",
    budget_id: budgetId,
    project_id: projectId,
  };
}

/**
 * Parses metragem string ("25m²", "120 m2", "85.5") to numeric value.
 * Returns null if no valid number can be extracted.
 */
function parseMetragem(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const str = String(value).trim();
  if (!str) return null;
  // Extract first numeric token (handles "25m²", "120 m2", "1.250,50 m²", etc.)
  const match = str.replace(/\./g, "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) ? num : null;
}

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
    total_area: parseMetragem(budget.metragem),
    estimated_duration_weeks: budget.estimated_weeks,
    budget_value: totalValue,
    budget_code: budget.sequential_code,
    status: "draft",
    notes: budget.internal_notes,
    consultora_comercial: budget.consultora_comercial,
    contract_file_url: budget.contract_file_url ?? null,
  };
}

/**
 * Builds the full budget breakdown payload for the Portal.
 */
function buildBudgetBreakdown(sections: any[], items: any[], adjustments: any[], totalValue: number) {
  const itemsBySection: Record<string, any[]> = {};
  for (const item of items) {
    if (!itemsBySection[item.section_id]) {
      itemsBySection[item.section_id] = [];
    }
    itemsBySection[item.section_id].push(item);
  }

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
