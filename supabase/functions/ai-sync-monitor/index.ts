import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SyncLog {
  id: string;
  source_system: string;
  target_system: string;
  entity_type: string;
  source_id: string;
  target_id: string | null;
  sync_status: string;
  error_message: string | null;
  attempts: number;
  payload: any;
  created_at: string;
  synced_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action } = await req.json();

    // Fetch recent sync logs
    const { data: logs, error: logsError } = await supabase
      .from("integration_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (logsError) throw new Error(`DB error: ${logsError.message}`);

    const failedLogs = (logs as SyncLog[]).filter((l) => l.sync_status === "failed");
    const pendingLogs = (logs as SyncLog[]).filter((l) => l.sync_status === "pending");
    const successLogs = (logs as SyncLog[]).filter((l) => l.sync_status === "success");

    // Build context for AI
    const statsContext = `
## Estado Atual da Sincronização
- Total de registros recentes: ${logs?.length ?? 0}
- Sucessos: ${successLogs.length}
- Falhas: ${failedLogs.length}
- Pendentes: ${pendingLogs.length}

## Registros com Falha
${failedLogs.length === 0 ? "Nenhuma falha encontrada." : failedLogs.map((l) => `
- ID: ${l.id}
  Source: ${l.source_system} → ${l.target_system}
  Tipo: ${l.entity_type}
  Source ID: ${l.source_id}
  Erro: ${l.error_message ?? "sem mensagem"}
  Tentativas: ${l.attempts}
  Payload: ${JSON.stringify(l.payload ?? {}).substring(0, 500)}
`).join("\n")}

## Registros Pendentes
${pendingLogs.length === 0 ? "Nenhum pendente." : pendingLogs.map((l) => `
- ID: ${l.id} | ${l.entity_type} | Source: ${l.source_id} | Tentativas: ${l.attempts}
`).join("\n")}
`;

    const systemPrompt = `Você é um engenheiro de integração sênior especializado no sistema Envision ↔ Portal BWild.
Sua função é analisar logs de sincronização, identificar problemas e propor correções automáticas.

Contexto do sistema:
- Envision envia fornecedores (suppliers) e projetos (budgets com contrato_fechado) para o Portal BWild
- Portal BWild pode enviar fornecedores de volta para o Envision
- A comunicação usa Edge Functions com header x-integration-key
- Logs são gravados na tabela integration_sync_log

Ao analisar, você deve:
1. Identificar padrões de falha (ex: campo obrigatório ausente, timeout, chave inválida)
2. Classificar a severidade (crítica, alta, média, baixa)
3. Propor ações corretivas concretas

Quando action="auto_fix", você DEVE retornar um JSON com a chave "fixes" contendo um array de correções a serem aplicadas.
Cada fix deve ter: { "log_id": "uuid", "action": "retry" | "skip" | "update_payload", "reason": "explicação", "updated_payload": {} }

Quando action="analyze", retorne apenas a análise em markdown.

IMPORTANTE: Seja conservador nas correções automáticas. Só proponha "update_payload" quando tiver certeza do problema.
Prefira "retry" para erros de timeout/rede e "skip" para registros irrecuperáveis (>5 tentativas sem progresso).`;

    let userPrompt: string;
    if (action === "auto_fix") {
      userPrompt = `${statsContext}

Analise os registros com falha acima e retorne SOMENTE um JSON válido com as correções propostas.
Formato: { "analysis": "resumo da análise", "fixes": [...], "risk_level": "low|medium|high" }
Não inclua markdown code fences, apenas o JSON puro.`;
    } else {
      userPrompt = `${statsContext}

Faça uma análise completa da saúde da integração. Inclua:
1. **Resumo Executivo** — status geral em 1-2 frases
2. **Problemas Identificados** — liste cada problema com severidade
3. **Padrões de Falha** — agrupe erros similares
4. **Recomendações** — ações concretas priorizadas
5. **Score de Saúde** — de 0 a 100, onde 100 = tudo perfeito`;
    }

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error [${status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content ?? "";

    // If auto_fix, parse and apply fixes
    if (action === "auto_fix") {
      let fixPlan: any;
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        fixPlan = JSON.parse(jsonMatch ? jsonMatch[0] : aiContent);
      } catch {
        return new Response(JSON.stringify({
          analysis: aiContent,
          fixes_applied: 0,
          error: "AI não retornou JSON válido para correções. Análise retornada como texto.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fixes = fixPlan.fixes ?? [];
      const results: any[] = [];

      for (const fix of fixes) {
        try {
          if (fix.action === "retry") {
            // Re-trigger the sync via the appropriate outbound function
            const logEntry = failedLogs.find((l) => l.id === fix.log_id);
            if (!logEntry) {
              results.push({ log_id: fix.log_id, status: "skipped", reason: "Log not found" });
              continue;
            }

            const fnName = logEntry.entity_type === "supplier"
              ? "sync-supplier-outbound"
              : "sync-project-outbound";
            const body = logEntry.entity_type === "supplier"
              ? { supplier_id: logEntry.source_id }
              : { budget_id: logEntry.source_id };

            const retryRes = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify(body),
            });

            const retryData = await retryRes.text();
            results.push({
              log_id: fix.log_id,
              status: retryRes.ok ? "retried" : "retry_failed",
              reason: fix.reason,
              response: retryData.substring(0, 200),
            });
          } else if (fix.action === "skip") {
            // Mark as skipped
            await supabase
              .from("integration_sync_log")
              .update({ sync_status: "skipped", error_message: `AI skip: ${fix.reason}` })
              .eq("id", fix.log_id);

            results.push({ log_id: fix.log_id, status: "skipped", reason: fix.reason });
          } else if (fix.action === "update_payload") {
            // Update payload and retry
            if (fix.updated_payload) {
              await supabase
                .from("integration_sync_log")
                .update({ payload: fix.updated_payload, sync_status: "pending" })
                .eq("id", fix.log_id);
            }
            results.push({ log_id: fix.log_id, status: "payload_updated", reason: fix.reason });
          }
        } catch (fixErr: any) {
          results.push({ log_id: fix.log_id, status: "error", reason: fixErr.message });
        }
      }

      return new Response(JSON.stringify({
        analysis: fixPlan.analysis ?? "",
        risk_level: fixPlan.risk_level ?? "unknown",
        fixes_proposed: fixes.length,
        fixes_applied: results.filter((r) => r.status !== "error").length,
        results,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // analyze mode — return markdown
    return new Response(JSON.stringify({ content: aiContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-sync-monitor error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
