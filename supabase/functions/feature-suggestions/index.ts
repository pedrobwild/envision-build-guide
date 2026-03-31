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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
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

    // Step 2: Use Lovable AI to generate contextual suggestions
    const systemPrompt = `Você é um Product Manager sênior especializado em software de gestão de obras e reformas residenciais. Você está analisando um sistema REAL em produção para sugerir NOVAS FUNCIONALIDADES baseadas em benchmarking de concorrentes.

## Sistema Atual
Este é um sistema de gestão de orçamentos de reformas residenciais com módulos: Orçamento Público, Editor de Orçamento, Dashboard Admin, Pipeline Comercial, Catálogo, Gestão de Usuários, Workspace de Produção, Financeiro.

## Área Sendo Analisada
${areaDescription}

${benchmarkData ? `## Pesquisa de Benchmarking (dados reais de concorrentes)
${benchmarkData}` : ""}

## Formato de Resposta OBRIGATÓRIO
Para cada sugestão, siga EXATAMENTE este formato:

### Sugestão XX: [Título da Funcionalidade] ([Categoria])
**Problema atual:** O que falta no sistema atual ou qual dor do usuário não está sendo atendida. Referencie componentes reais.
**Solução proposta:** Descrição detalhada da nova funcionalidade, referenciando onde ela se encaixaria no sistema atual (componentes, fluxos, telas).
**Benchmark:** Qual software concorrente já implementa algo similar e como.
**Impacto esperado:** Resultado mensurável ou qualitativo para o negócio.
**Prioridade:** 🔴 Alta / 🟡 Média / 🟢 Baixa
**Complexidade de implementação:** 🔵 Simples / 🟠 Moderada / 🔴 Complexa

---

## Regras
1. Gere entre 5 e 8 sugestões de NOVAS funcionalidades (não melhorias de UX)
2. Organize por categorias: "Automação & IA", "Experiência do Cliente", "Gestão Financeira", "Comunicação & Colaboração", "Relatórios & Analytics", "Integrações"
3. Cada sugestão DEVE referenciar componentes reais do sistema e indicar onde a funcionalidade seria implementada
4. Inclua benchmarks reais de concorrentes quando possível
5. Priorize funcionalidades com ROI claro e diferenciação competitiva
6. Considere a arquitetura existente (React + Supabase + Edge Functions)`;

    const userPrompt = context
      ? `Gere sugestões de novas funcionalidades para a área descrita. Contexto adicional: "${context}"`
      : `Gere sugestões de novas funcionalidades para a área descrita, baseando-se em benchmarking de concorrentes.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
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
    const content = data.choices?.[0]?.message?.content ?? "";

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