import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_AREAS: Record<string, string> = {
  orcamento_publico: `**Orçamento Público (PublicBudget)**
Página pública enviada ao cliente via link único (public_id). Componentes principais:
- BudgetHeader: nome do cliente (Title Case), versão, validade com countdown
- TrustStrip: chips scrolláveis com diferenciais (Preço fixo, Garantia 5 anos, etc.)
- SectionNav (desktop): sidebar fixa com scrollspy para navegação por categorias
- SectionCard: cards colapsáveis por categoria (Elétrica, Hidráulica, etc.) com itens, quantidades e preços opcionais
- CategoryDetailDialog: modal de detalhamento com galeria de fotos dos itens
- BudgetSummary: resumo financeiro com total, opcionais selecionados e simulador de parcelas
- MobileBottomBar: CTA dinâmico que alterna entre "Ver escopo", "Simular parcelas" e "Solicitar Contrato"
- MobileHeroCard: card hero compacto no mobile com valor total e CTA principal
- OptionalItemsSimulator: simulador interativo para cliente incluir/excluir seções opcionais
- InstallmentSimulator: simulador de parcelamento com entrada + parcelas
- ContractRequestDialog: formulário de solicitação de contrato
- WhatsAppButton: botão flutuante de contato
- ProjectGallery, Tour3DViewer, FloorPlanViewer: mídia do projeto
- ValidityCountdown: contador regressivo de validade do orçamento
- NextSteps: etapas pós-aprovação
- BudgetFAQ: perguntas frequentes
- ReclameAquiSeal: selo de reputação`,

  editor_orcamento: `**Editor de Orçamento (BudgetEditorV2)**
Workspace interno para orçamentistas criarem/editarem orçamentos. Fluxo em stepper:
- MetadataStep: dados do cliente, projeto, endereço, metragem
- SpreadsheetImportStep: importação de planilha Excel com preview e mapeamento de colunas
- FloorPlanUploadStep: upload de planta baixa
- RoomDrawingStep: desenho de cômodos sobre a planta
- CoverageMappingStep: mapeamento de cobertura de itens por cômodo
- SectionsEditor: editor de seções e itens com drag-and-drop, preços internos, catálogo
- HeaderConfigStep: configuração do cabeçalho público
- MediaUploadSection: upload de fotos e tours 3D
- WorkflowBar: barra de ações (salvar, publicar, enviar para revisão)
- VersionHistoryPanel: histórico de versões com diff
- AddItemPopover: popover para adicionar itens do catálogo ou avulsos`,

  dashboard_admin: `**Dashboard Administrativo (AdminDashboard)**
Hub executivo centralizado com:
- KPIs globais: receita, lucro, contratos fechados, orçamentos em andamento
- Atalhos dinâmicos baseados no papel (Admin/Comercial/Orçamentista)
- Listagem compacta de orçamentos com badges de versão (V1, V2), status de publicação
- Indicadores de lucratividade para projetos fechados
- Links rápidos para Produção, Pipeline Comercial, Financeiro`,

  pipeline_comercial: `**Pipeline Comercial (CommercialDashboard)**
Kanban board para gestão comercial de demandas:
- KanbanBoard: colunas de status (nova_demanda, orcamento_solicitado, minuta_enviada, etc.)
- Cards com nome do cliente, projeto, valor, prazo, responsável
- Drag-and-drop entre colunas com registro de transição
- Filtros por comercial, prioridade, período
- BudgetRequestsList: lista de solicitações de orçamento pendentes
- NewBudgetRequest: formulário de nova solicitação com briefing`,

  catalogo: `**Catálogo de Itens (CatalogPage)**
Gestão centralizada de itens, categorias e fornecedores:
- ItemsTab: listagem de itens com busca, filtros por categoria e tipo (produto/serviço)
- CategoriesTab: CRUD de categorias
- SuppliersTab: CRUD de fornecedores com informações de contato
- SupplierPricesPanel: painel de preços por fornecedor com SKU, preço unitário, lead time
- CatalogItemDialog: formulário de item com imagem, código interno, unidade de medida
- Integração com editor de orçamento para inserção rápida de itens catalogados`,

  gestao_usuarios: `**Gestão de Usuários (UserManagement)**
Administração de usuários e papéis:
- Listagem de usuários com nome, email, papel, status (ativo/inativo)
- Atribuição de papéis: admin, comercial, orcamentista
- Ativação/desativação de contas
- Edge function admin-users para operações privilegiadas`,

  workspace_producao: `**Workspace de Produção (BudgetInternalDetail)**
Centro de trabalho da orçamentista:
- Briefing operacional e instruções do comercial
- Timeline de eventos auditável (budget_events)
- Sistema de comentários internos (budget_comments)
- Banner de alerta para pendências
- Bloqueio de produção com justificativa obrigatória
- Transições de status: em_producao, waiting_info, entregue`,

  navegacao_geral: `**Navegação Geral (AppSidebar + AdminLayout)**
Estrutura de navegação e layout:
- Sidebar colapsável com grupos: Principal, Comercial, Ferramentas
- Itens de menu condicionais por papel (RoleGuard)
- AdminBreadcrumb: breadcrumb dinâmico baseado na rota
- ThemeToggle: alternância claro/escuro
- ProtectedRoute: HOC de autenticação
- Responsividade: sidebar drawer no mobile
- Login/Logout com redirecionamento inteligente`,

  financeiro: `**Financeiro (FinancialHistory)**
Histórico e gestão financeira:
- Listagem de orçamentos fechados com valores de venda e custo interno
- Cálculo de margem de lucro por projeto
- Ajustes financeiros (adjustments): adições e deduções por orçamento
- Exportação de dados financeiros`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { area, context } = await req.json();
    if (!area || !SYSTEM_AREAS[area]) {
      return new Response(JSON.stringify({ error: "Área inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const areaDescription = SYSTEM_AREAS[area];

    const systemPrompt = `Você é um Principal Designer / Head of UX para SaaS B2B de gestão de obras e reformas residenciais. 15+ anos analisando produtos reais. Sua análise é PRÁTICA, ESPECÍFICA e ACIONÁVEL — nunca genérica.

## Sobre o Sistema
Sistema de gestão de orçamentos de reformas residenciais com módulos:
- Orçamento Público: página pública enviada ao cliente com detalhamento de escopo, preços e simulador
- Editor de Orçamento: workspace interno para orçamentistas com importação de planilha e editor visual
- Dashboard Administrativo: hub executivo com KPIs e atalhos por papel
- Pipeline Comercial: kanban de gestão comercial de demandas
- Catálogo: gestão centralizada de itens, categorias e fornecedores
- Gestão de Usuários: administração de papéis (admin, comercial, orcamentista)
- Workspace de Produção: centro de trabalho da orçamentista com briefing e timeline
- Financeiro: histórico e análise de margem por projeto

## Área sendo analisada
${areaDescription}

## Princípios da sua análise
1. **Componentes reais** — toda sugestão DEVE citar componentes do sistema pelo nome exato (ex: \`BudgetSummary\`, \`KanbanBoard\`, \`SectionCard\`).
2. **Cruzamento de dimensões** — combine pelo menos duas: comportamento × layout, copy × hierarquia, friction × confiança.
3. **Mobile + Desktop** — pelo menos 1 sugestão deve abordar diferenças entre breakpoints.
4. **ROI claro** — priorize sugestões que aumentem conversão, reduzam tempo de tarefa, ou diminuam suporte.
5. **Anti-padrões evitados** — NÃO sugira "adicionar tutorial", "melhorar UX", "fazer testes" (genérico). Diga exatamente O QUÊ mudar e ONDE.
6. **Baseado em heurísticas reais** — Nielsen, Lei de Hick, Fitts, Jakob, von Restorff. Cite a heurística quando aplicável.

## Formato de Resposta OBRIGATÓRIO
Para cada sugestão, siga EXATAMENTE este formato:

### Sugestão XX: [Título específico e direto] ([Categoria])
**Problema atual:** Descrição específica do problema, citando o componente exato e o comportamento observável que prejudica o usuário. Inclua uma estimativa de impacto (ex: "usuários abandonam o passo X em ~30%").
**Solução proposta:** Mudança concreta no componente \`NomeDoComponente\`. Detalhe interação, copy alternativo, hierarquia visual ou layout. Cite a heurística aplicada quando relevante.
**Impacto esperado:** Métrica que melhora (conversão, tempo de tarefa, taxa de erro, NPS) com magnitude estimada.
**Esforço de implementação:** 🔵 Baixo (≤2h) / 🟠 Médio (≤1 dia) / 🔴 Alto (>1 dia)
**Prioridade:** 🔴 Alta / 🟡 Média / 🟢 Baixa

---

## Regras finais
1. Gere entre 6 e 8 sugestões organizadas em 4-5 categorias (ex: "Hierarquia & Navegação", "Copywriting & Microcopy", "Performance & Feedback", "Acessibilidade", "Fluxo de Conversão", "Confiança & Trust").
2. Ordene da mais impactante para a menos impactante.
3. Pelo menos 2 sugestões devem ser de prioridade 🔴 Alta com esforço 🔵 Baixo ou 🟠 Médio (quick wins).
4. Encerre com uma seção \`## Resumo Executivo\` (3-4 bullets) destacando os 3 quick wins prioritários.`;

    const userPrompt = context
      ? `Gere sugestões de melhoria de UX para a área descrita. Contexto adicional do usuário: "${context}"`
      : `Gere sugestões de melhoria de UX para a área descrita.`;

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
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na API de IA", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ux-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});