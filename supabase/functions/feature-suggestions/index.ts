import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_AREAS: Record<string, string> = {
  orcamento_publico: `**Orçamento Público (PublicBudget)**
Página pública enviada ao cliente via link único. Componentes: BudgetHeader, TrustStrip, SectionNav (scrollspy), SectionCard (categorias colapsáveis), BudgetSummary (resumo + simulador de parcelas), OptionalItemsSimulator, InstallmentSimulator, ContractRequestDialog, WhatsAppButton, ProjectGallery, Tour3DViewer, FloorPlanViewer, ValidityCountdown, NextSteps, BudgetFAQ, ReclameAquiSeal, MobileBottomBar, MobileHeroCard.
Funcionalidades atuais: visualização de escopo com preços opcionais, simulador de parcelas, solicitação de contrato, galeria de fotos, tour 3D, FAQ, contador de validade.`,

  editor_orcamento: `**Editor de Orçamento (BudgetEditorV2)**
Workspace interno com stepper: MetadataStep, SpreadsheetImportStep (Excel), FloorPlanUploadStep, RoomDrawingStep, CoverageMappingStep, SectionsEditor (drag-and-drop), HeaderConfigStep, MediaUploadSection, WorkflowBar, VersionHistoryPanel, AddItemPopover.
Funcionalidades atuais: importação de planilha, editor visual de seções/itens, versionamento, publicação, upload de mídia.`,

  dashboard_admin: `**Dashboard Administrativo (AdminDashboard)**
Hub executivo: KPIs globais (receita, lucro, contratos), atalhos por papel, listagem de orçamentos com badges de versão e status, indicadores de lucratividade.
Funcionalidades atuais: visão consolidada, navegação rápida por papel.`,

  pipeline_comercial: `**Pipeline Comercial (CommercialDashboard)**
Kanban: KanbanBoard com colunas de status, cards com dados do cliente, drag-and-drop, filtros, BudgetRequestsList, NewBudgetRequest.
Funcionalidades atuais: gestão visual de demandas, transições de status, solicitações de orçamento.`,

  catalogo: `**Catálogo (CatalogPage)**
Gestão: ItemsTab, CategoriesTab, SuppliersTab, SupplierPricesPanel, CatalogItemDialog.
Funcionalidades atuais: CRUD de itens/categorias/fornecedores, preços por fornecedor, integração com editor.`,

  gestao_usuarios: `**Gestão de Usuários (UserManagement)**
Administração: listagem, papéis (admin/comercial/orcamentista), ativação/desativação, edge function admin-users.
Funcionalidades atuais: RBAC, gestão de contas.`,

  workspace_producao: `**Workspace de Produção (BudgetInternalDetail)**
Centro de trabalho: briefing, timeline de eventos, comentários internos, bloqueio com justificativa, transições de status.
Funcionalidades atuais: colaboração interna, auditoria de mudanças.`,

  navegacao_geral: `**Navegação (AppSidebar + AdminLayout)**
Estrutura: sidebar colapsável, menus condicionais por papel, breadcrumb, tema claro/escuro, autenticação, responsividade mobile.`,

  financeiro: `**Financeiro (FinancialHistory)**
Histórico: orçamentos fechados, margem de lucro, ajustes financeiros, exportação.
Funcionalidades atuais: análise de rentabilidade por projeto.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    // Either Anthropic direct or Lovable Gateway fallback is acceptable.
    if (!ANTHROPIC_API_KEY && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada (ANTHROPIC_API_KEY ou LOVABLE_API_KEY)." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { area, context } = await req.json();
    if (!area || !SYSTEM_AREAS[area]) {
      return new Response(JSON.stringify({ error: "Área inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const areaDescription = SYSTEM_AREAS[area];

    // Step 1: Use Perplexity for benchmarking research (if available)
    let benchmarkData = "";
    if (PERPLEXITY_API_KEY) {
      try {
        const areaLabel = area.replace(/_/g, " ");
        const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sonar-pro",
            messages: [
              { role: "system", content: "Você é um analista de produto. Pesquise funcionalidades de concorrentes de softwares de gestão de obras e reformas para a área especificada. Liste funcionalidades concretas com nomes de software. Seja objetivo." },
              { role: "user", content: `Quais são as funcionalidades mais inovadoras e diferenciadas dos principais softwares de gestão de obras (Houzz Pro, Buildertrend, CoConstruct, Procore, Veja Obra, Obra Prima, Sienge, Construct Connect) na área de: ${areaLabel}? Foque em funcionalidades que agreguem valor real ao usuário final.` },
            ],
            search_recency_filter: "month",
          }),
        });
        if (perplexityRes.ok) {
          const pData = await perplexityRes.json();
          benchmarkData = pData.choices?.[0]?.message?.content ?? "";
        }
      } catch (e) {
        console.error("Perplexity benchmarking error (non-fatal):", e);
      }
    }

    // Step 2: Generate contextual suggestions
    const systemPrompt = `Você é um Principal Product Manager / Head of Product para SaaS B2B de gestão de obras e reformas residenciais. 12+ anos lançando features que movem KPI de negócio. Sua análise é PRÁTICA e ESPECÍFICA.

## Sistema Atual
Sistema de gestão de orçamentos de reformas residenciais com módulos: Orçamento Público, Editor de Orçamento, Dashboard Admin, Pipeline Comercial, Catálogo, Gestão de Usuários, Workspace de Produção, Financeiro. Stack: React + TypeScript + Supabase (Postgres + Edge Functions Deno).

## Área Sendo Analisada
${areaDescription}

${benchmarkData ? `## Pesquisa de Benchmarking (dados reais de concorrentes)
${benchmarkData}` : ""}

## Princípios da sua análise
1. **Diferenciação competitiva** — priorize features que CRIAM vantagem, não só paridade.
2. **ROI quantificável** — toda sugestão deve apontar a métrica que melhora (conversão, ticket, retenção, NPS, churn, custo/orçamento).
3. **Componentes reais** — cite componentes do sistema pelo nome exato e onde a feature se encaixa.
4. **Stack realista** — só sugira features implementáveis com React + Supabase + Edge Functions. Cite a tabela / função / componente que precisaria mudar.
5. **Benchmark concreto** — quando citar concorrente, diga o software, a feature equivalente, e o que pode ser MELHOR aqui.
6. **Anti-padrão** — NÃO sugira "adicionar IA" genérico. Diga exatamente: o INPUT, o MODELO, o OUTPUT, o COMPONENTE de UI.

## Formato de Resposta OBRIGATÓRIO
### Sugestão XX: [Título específico e direto] ([Categoria])
**Problema atual:** Dor concreta do usuário ou gap competitivo. Cite o componente atual e o atrito observável.
**Solução proposta:** Descrição da feature com 3-5 frases. Cite componentes \`NomeComponente\`, tabelas, edge functions e fluxos exatos onde se encaixa.
**Benchmark:** [Concorrente específico] — como implementa hoje. O que podemos fazer DIFERENTE/MELHOR.
**Impacto esperado:** Métrica de negócio + magnitude estimada (ex: "+8-12% conversão de orçamento → contrato").
**Esforço de engenharia:** 🔵 1-2 dias / 🟠 1 semana / 🔴 2+ semanas
**Prioridade:** 🔴 Alta / 🟡 Média / 🟢 Baixa

---

## Regras finais
1. Entre 6 e 8 sugestões de NOVAS funcionalidades (não melhorias cosméticas de UX).
2. Organize em 4-5 categorias: "Automação & IA", "Experiência do Cliente", "Gestão Financeira", "Comunicação & Colaboração", "Relatórios & Analytics", "Integrações".
3. Pelo menos 2 sugestões devem ser quick wins (esforço 🔵 1-2 dias com prioridade 🔴 Alta).
4. Encerre com \`## Roadmap sugerido\` priorizando 3 features para os próximos 30 dias com base em ROI/esforço.`;

    const userPrompt = context
      ? `Gere sugestões de novas funcionalidades para a área descrita. Contexto adicional do solicitante: "${context}"`
      : `Gere sugestões de novas funcionalidades para a área descrita, baseando-se em benchmarking de concorrentes.`;

    let content = "";

    if (ANTHROPIC_API_KEY) {
      // Preferred path — Anthropic direct (richer reasoning).
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 6000,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Claude API error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402 || response.status === 403) {
          // Fall through to Lovable Gateway if available, otherwise surface error.
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "Créditos de IA esgotados ou chave inválida." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          return new Response(JSON.stringify({ error: "Erro na API Claude", detail: errText }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const data = await response.json();
        content = data.content
          ?.filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n") ?? "";
      }
    }

    if (!content && LOVABLE_API_KEY) {
      // Fallback — Lovable AI Gateway (Gemini Pro for stronger reasoning).
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Lovable Gateway error:", response.status, errText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Erro na API de IA", detail: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content ?? "";
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("feature-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
