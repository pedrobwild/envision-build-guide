import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-integration-key",
};

/**
 * sync-supplier-inbound
 * 
 * Receives supplier/fornecedor data FROM Portal BWild → Envision.
 * Validates the integration key and upserts into the local suppliers table.
 * 
 * POST body:
 *   { fornecedor: { ...fornecedor fields }, source_id: string }
 *   { fornecedores: [{ ...fornecedor fields, source_id }] }  — batch
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: validate integration key ---
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_INBOUND_KEY");

    if (!expectedKey) {
      throw new Error("INTEGRATION_INBOUND_KEY not configured");
    }

    if (integrationKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    // Normalize to array
    const items: Array<{ fornecedor: any; source_id: string }> = body.fornecedores
      ? body.fornecedores.map((f: any) => ({ fornecedor: f, source_id: f.source_id ?? f.id }))
      : [{ fornecedor: body.fornecedor, source_id: body.source_id }];

    const results: Array<{ source_id: string; status: string; supplier_id?: string; error?: string }> = [];

    for (const { fornecedor, source_id } of items) {
      if (!fornecedor || !source_id) {
        results.push({ source_id: source_id ?? "unknown", status: "skipped", error: "Missing data" });
        continue;
      }

      try {
        // Map Portal BWild fornecedor → Envision supplier
        const supplierPayload = mapFornecedorToSupplier(fornecedor);

        // Check if already linked
        const { data: existing } = await db
          .from("suppliers")
          .select("id")
          .eq("external_id", source_id)
          .eq("external_system", "portal_bwild")
          .maybeSingle();

        let supplierId: string;

        if (existing) {
          // Update
          await db.from("suppliers").update(supplierPayload).eq("id", existing.id);
          supplierId = existing.id;
        } else {
          // Insert
          const { data: inserted, error: insertErr } = await db
            .from("suppliers")
            .insert({
              ...supplierPayload,
              external_id: source_id,
              external_system: "portal_bwild",
            })
            .select("id")
            .single();
          if (insertErr) throw insertErr;
          supplierId = inserted.id;
        }

        // Log sync
        await db.from("integration_sync_log").upsert({
          source_system: "portal_bwild",
          target_system: "envision",
          entity_type: "supplier",
          source_id: source_id,
          target_id: supplierId,
          sync_status: "success",
          payload: fornecedor,
          attempts: 1,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "source_system,entity_type,source_id",
        });

        results.push({ source_id, status: "success", supplier_id: supplierId });
      } catch (err: any) {
        console.error(`Failed to sync fornecedor ${source_id}:`, err);

        await db.from("integration_sync_log").upsert({
          source_system: "portal_bwild",
          target_system: "envision",
          entity_type: "supplier",
          source_id: source_id,
          sync_status: "failed",
          payload: fornecedor,
          error_message: err.message ?? String(err),
          attempts: 1,
        }, {
          onConflict: "source_system,entity_type,source_id",
        });

        results.push({ source_id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("sync-supplier-inbound error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Maps Portal BWild `fornecedores` → Envision `suppliers`.
 */
function mapFornecedorToSupplier(f: any) {
  return {
    name: f.nome ?? f.name ?? "",
    razao_social: f.razao_social ?? null,
    cnpj_cpf: f.cnpj_cpf ?? null,
    categoria: f.subcategoria ?? f.categoria ?? "Outros",
    endereco: f.endereco ?? null,
    cidade: f.cidade ?? null,
    estado: f.estado ?? null,
    email: f.email ?? null,
    telefone: f.telefone ?? null,
    site: f.site ?? null,
    condicoes_pagamento: f.condicoes_pagamento ?? null,
    prazo_entrega_dias: f.prazo_entrega_dias ?? null,
    produtos_servicos: f.produtos_servicos ?? null,
    nota: f.nota ?? null,
    observacoes: f.observacoes ?? null,
    contact_info: f.contato ?? null,
    is_active: f.is_active ?? true,
  };
}
