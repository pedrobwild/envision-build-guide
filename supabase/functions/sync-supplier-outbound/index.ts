import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * sync-supplier-outbound
 * 
 * Sends supplier data from Envision → Portal BWild.
 * Called via DB webhook trigger or manual invocation.
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
    // --- Config ---
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PORTAL_BWILD_SUPABASE_URL = Deno.env.get("PORTAL_BWILD_SUPABASE_URL");
    const PORTAL_BWILD_SERVICE_ROLE_KEY = Deno.env.get("PORTAL_BWILD_SERVICE_ROLE_KEY");

    if (!PORTAL_BWILD_SUPABASE_URL || !PORTAL_BWILD_SERVICE_ROLE_KEY) {
      throw new Error("Portal BWild credentials not configured (PORTAL_BWILD_SUPABASE_URL, PORTAL_BWILD_SERVICE_ROLE_KEY)");
    }

    const localDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const remoteDb = createClient(PORTAL_BWILD_SUPABASE_URL, PORTAL_BWILD_SERVICE_ROLE_KEY);

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
      // DB webhook payload format
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

    for (const supplier of suppliers ?? []) {
      try {
        // Check existing sync log
        const { data: existing } = await localDb
          .from("integration_sync_log")
          .select("id, target_id, attempts")
          .eq("source_system", "envision")
          .eq("entity_type", "supplier")
          .eq("source_id", supplier.id)
          .maybeSingle();

        // Map Envision supplier → Portal BWild fornecedor
        const fornecedorPayload = mapSupplierToFornecedor(supplier);

        let targetId: string | null = existing?.target_id ?? null;

        if (targetId) {
          // Update existing
          const { error: updateErr } = await remoteDb
            .from("fornecedores")
            .update(fornecedorPayload)
            .eq("id", targetId);
          if (updateErr) throw updateErr;
        } else {
          // Check if already exists by external_id
          const { data: existingRemote } = await remoteDb
            .from("fornecedores")
            .select("id")
            .eq("external_id", supplier.id)
            .eq("external_system", "envision")
            .maybeSingle();

          if (existingRemote) {
            targetId = existingRemote.id;
            const { error: updateErr } = await remoteDb
              .from("fornecedores")
              .update(fornecedorPayload)
              .eq("id", targetId);
            if (updateErr) throw updateErr;
          } else {
            // Insert new
            const { data: inserted, error: insertErr } = await remoteDb
              .from("fornecedores")
              .insert({
                ...fornecedorPayload,
                external_id: supplier.id,
                external_system: "envision",
              })
              .select("id")
              .single();
            if (insertErr) throw insertErr;
            targetId = inserted.id;
          }
        }

        // Update sync log
        const syncData = {
          source_system: "envision",
          target_system: "portal_bwild",
          entity_type: "supplier",
          source_id: supplier.id,
          target_id: targetId,
          sync_status: "success",
          payload: fornecedorPayload,
          error_message: null,
          attempts: (existing?.attempts ?? 0) + 1,
          synced_at: new Date().toISOString(),
        };

        if (existing) {
          await localDb.from("integration_sync_log").update(syncData).eq("id", existing.id);
        } else {
          await localDb.from("integration_sync_log").insert(syncData);
        }

        results.push({ id: supplier.id, status: "success" });
      } catch (err: any) {
        console.error(`Failed to sync supplier ${supplier.id}:`, err);

        // Log failure
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

        const { data: existingLog } = await localDb
          .from("integration_sync_log")
          .select("id, attempts")
          .eq("source_system", "envision")
          .eq("entity_type", "supplier")
          .eq("source_id", supplier.id)
          .maybeSingle();

        if (existingLog) {
          await localDb.from("integration_sync_log").update({
            ...failData,
            attempts: existingLog.attempts + 1,
          }).eq("id", existingLog.id);
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
 * Maps Envision `suppliers` row → Portal BWild `fornecedores` insert payload.
 * Adjust field names to match Portal BWild schema.
 */
function mapSupplierToFornecedor(supplier: any) {
  // Determine tipo based on categoria
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
