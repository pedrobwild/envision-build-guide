import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-supplier-outbound
 *
 * Sends supplier data from Envision → Portal BWild via HTTP POST
 * to the Portal's sync-supplier-inbound edge function.
 *
 * POST body:
 *   { supplier_id: string }           — sync a single supplier
 *   { supplier_ids: string[] }        — sync multiple suppliers
 *   { action: "retry_failed" }        — retry all failed syncs
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
    let supplierIds: string[] = [];

    // --- Determine which suppliers to sync ---
    if (body.action === "retry_failed") {
      const { data: failed } = await localDb
        .from("integration_sync_log")
        .select("source_id")
        .eq("source_system", "envision")
        .eq("entity_type", "supplier")
        .eq("sync_status", "failed")
        .lt("attempts", 5);
      supplierIds = (failed ?? []).map((r) => r.source_id);
    } else if (body.supplier_id) {
      supplierIds = [body.supplier_id];
    } else if (body.supplier_ids) {
      supplierIds = body.supplier_ids;
    } else if (body.type === "INSERT" || body.type === "UPDATE") {
      supplierIds = [body.record?.id ?? body.old_record?.id].filter(Boolean);
    }

    if (supplierIds.length === 0) {
      return new Response(JSON.stringify({ message: "No suppliers to sync" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch suppliers ---
    const { data: suppliers, error: fetchErr } = await localDb
      .from("suppliers")
      .select("*")
      .in("id", supplierIds);

    if (fetchErr) throw fetchErr;

    const results: Array<{ id: string; status: string; error?: string }> = [];
    const inboundUrl = `${PORTAL_BWILD_SUPABASE_URL}/functions/v1/sync-supplier-inbound`;

    for (const supplier of suppliers ?? []) {
      try {
        const existingLog = await localDb
          .from("integration_sync_log")
          .select("id, attempts")
          .eq("source_system", "envision")
          .eq("entity_type", "supplier")
          .eq("source_id", supplier.id)
          .maybeSingle();

        const fornecedorPayload = mapSupplierToFornecedor(supplier);

        // --- Call Portal BWild's inbound endpoint ---
        const response = await fetch(inboundUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-integration-key": INTEGRATION_KEY,
          },
          body: JSON.stringify({
            fornecedor: fornecedorPayload,
            source_id: supplier.id,
          }),
        });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(`Portal returned ${response.status}: ${responseData.error ?? response.statusText}`);
        }

        const targetId = responseData.results?.[0]?.supplier_id ?? null;

        // Log success
        const syncData = {
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "supplier",
          source_id: supplier.id,
          target_id: targetId,
          sync_status: "success",
          payload: fornecedorPayload,
          error_message: null,
          attempts: (existingLog?.data?.attempts ?? 0) + 1,
          synced_at: new Date().toISOString(),
        };

        if (existingLog?.data) {
          await localDb.from("integration_sync_log").update(syncData).eq("id", existingLog.data.id);
        } else {
          await localDb.from("integration_sync_log").insert(syncData);
        }

        results.push({ id: supplier.id, status: "success" });
      } catch (err: any) {
        console.error(`Failed to sync supplier ${supplier.id}:`, err);

        const failData = {
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "supplier",
          source_id: supplier.id,
          sync_status: "failed",
          payload: supplier,
          error_message: err.message ?? String(err),
          attempts: 1,
        };

        const { data: log } = await localDb
          .from("integration_sync_log")
          .select("id, attempts")
          .eq("source_system", "envision")
          .eq("entity_type", "supplier")
          .eq("source_id", supplier.id)
          .maybeSingle();

        if (log) {
          await localDb.from("integration_sync_log").update({
            ...failData,
            attempts: log.attempts + 1,
          }).eq("id", log.id);
        } else {
          await localDb.from("integration_sync_log").insert(failData);
        }

        results.push({ id: supplier.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sync-supplier-outbound error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Maps Envision `suppliers` row → Portal BWild `fornecedores` payload.
 */
function mapSupplierToFornecedor(supplier: any) {
  const categoriasServico = [
    "marcenaria", "serralheria", "gesso", "pintura", "elétrica",
    "hidráulica", "ar condicionado", "automação", "impermeabilização",
    "mão de obra", "instalação", "projeto", "demolição",
  ];
  const isServico = categoriasServico.some(
    (c) => supplier.categoria?.toLowerCase().includes(c)
  );

  return {
    nome: supplier.name,
    razao_social: supplier.razao_social,
    cnpj_cpf: supplier.cnpj_cpf,
    tipo: isServico ? "prestadores" : "produtos",
    subcategoria: supplier.categoria ?? "Outros",
    endereco: supplier.endereco,
    cidade: supplier.cidade,
    estado: supplier.estado,
    email: supplier.email,
    telefone: supplier.telefone,
    site: supplier.site,
    condicoes_pagamento: supplier.condicoes_pagamento,
    prazo_entrega_dias: supplier.prazo_entrega_dias,
    produtos_servicos: supplier.produtos_servicos,
    nota: supplier.nota,
    observacoes: supplier.observacoes,
    is_active: supplier.is_active,
    contato: supplier.contact_info,
  };
}
