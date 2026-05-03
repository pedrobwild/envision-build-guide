import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-integration-key",
};

/**
 * sync-suppliers-inbound (plural)
 *
 * Endpoint chamado pelo Portal BWild (`relatorio-carlos`) quando a função
 * `sync-suppliers-outbound` lá envia um fornecedor para o Envision.
 *
 * Diferenças em relação ao endpoint legado `sync-supplier-inbound` (singular):
 *  - Aceita o **payload achatado** que o Portal envia: `{ name, _source_system,
 *    _source_id, ...campos }` (sem wrapper `fornecedor`).
 *  - Responde com `{ success, target_id }` (formato esperado pelo outbound do
 *    Portal), em vez de `{ results: [...] }`.
 *
 * O endpoint singular continua existindo para compatibilidade retroativa com
 * integrações que ainda enviem `{ fornecedor: {...}, source_id }`.
 *
 * Auth: header `x-integration-key` validado contra `INTEGRATION_INBOUND_KEY`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Aceita 3 formas de payload:
    //   1. Achatado (Portal): { name, _source_system, _source_id, ...campos }
    //   2. Wrapper antigo:    { fornecedor: {...}, source_id: "..." }
    //   3. Batch:             { fornecedores: [...] } ou { suppliers: [...] }
    // deno-lint-ignore no-explicit-any
    let entries: Array<{ payload: any; sourceId: string; sourceSystem: string }> = [];

    if (Array.isArray(body.fornecedores) || Array.isArray(body.suppliers)) {
      const arr = body.fornecedores ?? body.suppliers ?? [];
      entries = arr.map((p: Record<string, unknown>) => ({
        payload: p,
        sourceId: String(p._source_id ?? p.source_id ?? p.id ?? ""),
        sourceSystem: String(p._source_system ?? "portal_bwild"),
      }));
    } else if (body.fornecedor) {
      entries = [{
        payload: body.fornecedor,
        sourceId: String(body.source_id ?? body.fornecedor.id ?? ""),
        sourceSystem: String(body.fornecedor._source_system ?? "portal_bwild"),
      }];
    } else {
      // Achatado (formato Portal)
      entries = [{
        payload: body,
        sourceId: String(body._source_id ?? body.source_id ?? body.id ?? ""),
        sourceSystem: String(body._source_system ?? "portal_bwild"),
      }];
    }

    const isBatch = entries.length > 1;
    const results: Array<{ source_id: string; status: string; target_id?: string; error?: string }> = [];

    for (const { payload, sourceId, sourceSystem } of entries) {
      if (!payload || !sourceId) {
        results.push({ source_id: sourceId || "unknown", status: "skipped", error: "Missing source_id or payload" });
        continue;
      }

      try {
        const supplierPayload = mapInboundToSupplier(payload);

        if (!supplierPayload.name) {
          throw new Error("Supplier name is required");
        }

        const { data: existing } = await db
          .from("suppliers")
          .select("id")
          .eq("external_id", sourceId)
          .eq("external_system", sourceSystem)
          .maybeSingle();

        let supplierId: string;

        if (existing) {
          await db.from("suppliers").update(supplierPayload).eq("id", existing.id);
          supplierId = existing.id;
        } else {
          const { data: inserted, error: insertErr } = await db
            .from("suppliers")
            .insert({
              ...supplierPayload,
              external_id: sourceId,
              external_system: sourceSystem,
            })
            .select("id")
            .single();
          if (insertErr) throw insertErr;
          supplierId = inserted.id;
        }

        await db.from("integration_sync_log").upsert({
          source_system: sourceSystem,
          target_system: "envision",
          entity_type: "supplier",
          source_id: sourceId,
          target_id: supplierId,
          sync_status: "success",
          payload,
          attempts: 1,
          synced_at: new Date().toISOString(),
        }, { onConflict: "source_system,entity_type,source_id" });

        results.push({ source_id: sourceId, status: "success", target_id: supplierId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to sync supplier ${sourceId}:`, err);

        await db.from("integration_sync_log").upsert({
          source_system: sourceSystem,
          target_system: "envision",
          entity_type: "supplier",
          source_id: sourceId,
          sync_status: "failed",
          payload,
          error_message: message,
          attempts: 1,
        }, { onConflict: "source_system,entity_type,source_id" });

        results.push({ source_id: sourceId, status: "failed", error: message });
      }
    }

    // Para chamadas single (formato Portal) devolve resposta achatada que o
    // outbound do Portal entende: { success, target_id }. Para batch devolve
    // a lista de resultados.
    if (!isBatch) {
      const r = results[0];
      if (r.status === "success") {
        return new Response(JSON.stringify({ success: true, target_id: r.target_id, source_id: r.source_id }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, error: r.error ?? "Sync failed", source_id: r.source_id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-suppliers-inbound error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Mapeia o payload de entrada (achatado ou wrapper) → linha de `suppliers`.
 *
 * Aceita campos vindos do Portal BWild (`nome`/`name`, `subcategoria`/`categoria`,
 * `nota_avaliacao`/`nota`, `contato`/`contact_info`) e cai para defaults
 * razoáveis quando ausentes.
 */
// deno-lint-ignore no-explicit-any
function mapInboundToSupplier(p: any) {
  const isActive = p.is_active !== undefined
    ? Boolean(p.is_active)
    : p.status !== undefined
      ? p.status === "ativo"
      : true;

  // Categoria preferencial: subcategoria/supplier_subcategory > categoria.
  // O Portal pode enviar `categoria` como o tipo geral (ex: "Prestadores")
  // e `supplier_subcategory` com a subcategoria real (ex: "Marcenaria").
  const categoria = p.supplier_subcategory
    ?? p.subcategoria
    ?? p.categoria
    ?? "Outros";

  return {
    name: p.nome ?? p.name ?? "",
    razao_social: p.razao_social ?? null,
    cnpj_cpf: p.cnpj_cpf ?? null,
    categoria,
    endereco: p.endereco ?? null,
    cidade: p.cidade ?? null,
    estado: p.estado ?? null,
    email: p.email ?? null,
    telefone: p.telefone ?? null,
    site: p.site ?? null,
    condicoes_pagamento: p.condicoes_pagamento ?? null,
    prazo_entrega_dias: p.prazo_entrega_dias ?? null,
    produtos_servicos: p.produtos_servicos ?? null,
    nota: p.nota ?? p.nota_avaliacao ?? null,
    observacoes: p.observacoes ?? null,
    contact_info: p.contato ?? p.contact_info ?? null,
    is_active: isActive,
  };
}
