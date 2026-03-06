import type { BudgetSummary } from "./orcamento-types";

export const mockBudget: BudgetSummary = {
  meta: {
    projectId: "demo",
    clientName: "Adriano",
    projectName: "Reforma Apt 182",
    area: "65 m²",
    version: "v2.1",
    validUntil: "2026-04-05",
    architect: "Lorena Matos",
    engineer: "Henrique Dias",
  },
  included: [
    "Projeto arquitetônico 100% personalizado",
    "Projeto 3D (layout, iluminação, marcenaria e decoração)",
    "Projeto executivo + memorial descritivo",
    "ART + burocracias (CREA e condomínio)",
    "Engenharia e gestão da obra + compras e logística",
    "Portal digital de acompanhamento + garantia de 5 anos",
  ],
  services: [
    {
      id: "arq",
      title: "Projeto Arquitetônico Personalizado",
      valueProp: "Seu apartamento é único — o projeto também precisa ser.",
      includes: [
        "Briefing exclusivo com a arquiteta",
        "Revisões ilimitadas dentro do escopo",
        "Contato direto com a arquiteta responsável",
        "Aprovação via sistema com histórico",
      ],
      result: "Projeto exclusivo para sua unidade, alinhado ao seu estilo.",
    },
    {
      id: "3d",
      title: "Projeto 3D",
      valueProp: "Veja cada ambiente antes de executar — sem surpresas.",
      includes: [
        "Layout otimizado",
        "Iluminação planejada",
        "Marcenaria sob medida",
        "Decoração e acabamentos",
      ],
      result: "Visualize e aprove antes de executar.",
    },
    {
      id: "exec",
      title: "Projeto Executivo",
      valueProp: "Documentação técnica completa para a obra.",
      includes: [
        "Plantas detalhadas (elétrica, hidráulica, paginação)",
        "Especificação de materiais e acabamentos",
        "Marcenaria sob medida com detalhamentos",
        "Memorial descritivo completo",
      ],
      result: "Execução precisa, sem improvisos.",
    },
    {
      id: "eng",
      title: "Engenharia e Gestão",
      valueProp: "Obra previsível com engenheiro dedicado.",
      includes: [
        "Mobilização e coordenação de mão de obra",
        "Compras e logística de materiais",
        "Gestão de cronograma e qualidade",
        "Engenheiro dedicado + atualização semanal",
      ],
      result: "Obra previsível e controlada.",
    },
  ],
  journey: [
    {
      id: 1,
      title: "Briefing com a arquiteta",
      whatHappens: [
        "Videochamada para entender estilo, objetivos e referências",
        "Definição de escopo e prazos iniciais",
        "Alinhamento de expectativas e prioridades",
      ],
      result: "Escopo definido e prioridades claras.",
    },
    {
      id: 2,
      title: "Projeto 3D",
      whatHappens: [
        "Desenvolvimento de layout e iluminação",
        "Marcenaria sob medida projetada",
        "Renders realistas para aprovação",
      ],
      result: "Projeto visual completo para aprovação.",
    },
    {
      id: 3,
      title: "Revisões e aprovação",
      whatHappens: [
        "Rodadas de ajustes até a aprovação final",
        "Aprovação digital com histórico",
        "Validação de materiais e acabamentos",
      ],
      result: "Projeto aprovado sem pendências.",
    },
    {
      id: 4,
      title: "Projeto executivo",
      whatHappens: [
        "Plantas técnicas detalhadas",
        "Memorial descritivo completo",
        "Especificações para execução",
      ],
      result: "Documentação técnica pronta para a obra.",
      proof: "Lista de documentos: planta elétrica, hidráulica, paginação, marcenaria, memorial.",
    },
    {
      id: 5,
      title: "Execução da obra",
      whatHappens: [
        "Engenheiro dedicado no canteiro",
        "Compras e logística gerenciadas",
        "Relatórios semanais no portal",
      ],
      result: "Obra em andamento com acompanhamento total.",
      proof: "Screenshot do portal com evolução semanal.",
    },
    {
      id: 6,
      title: "Entrega e garantia",
      whatHappens: [
        "Vistoria final com checklist completo",
        "Manual de uso e manutenção",
        "Certificado de garantia de 5 anos",
      ],
      result: "Projeto entregue com garantia estrutural.",
    },
  ],
  scope: [
    {
      id: "demo",
      title: "Demolições e remoções",
      items: [
        { title: "Demolição de paredes", summary: "Remoção de alvenaria conforme projeto", bullets: ["Parede entre sala e cozinha", "Fechamento de vão antigo", "Remoção de revestimento existente"] },
        { title: "Remoção de pisos", summary: "Preparação para novo revestimento", bullets: ["Remoção de cerâmica existente", "Nivelamento de contrapiso", "Descarte de entulho incluso"] },
      ],
    },
    {
      id: "inst",
      title: "Instalações",
      items: [
        { title: "Elétrica", summary: "Instalações elétricas conforme projeto", bullets: ["Novo QDC dimensionado", "Pontos de tomada e iluminação", "Infraestrutura para automação"] },
        { title: "Hidráulica", summary: "Instalações hidráulicas e de gás", bullets: ["Pontos de água quente e fria", "Esgoto e ventilação", "Ponto de gás para cooktop"] },
      ],
    },
    {
      id: "acab",
      title: "Acabamentos",
      items: [
        { title: "Revestimentos", summary: "Pisos e paredes conforme especificação", bullets: ["Porcelanato retificado 80×80", "Rodapé em porcelanato", "Pastilhas em áreas molhadas"] },
        { title: "Pintura", summary: "Pintura geral do apartamento", bullets: ["Massa corrida PVA", "Tinta acrílica acetinada", "Detalhes em tinta especial"] },
      ],
    },
    {
      id: "marc",
      title: "Marcenaria",
      items: [
        { title: "Cozinha", summary: "Marcenaria sob medida projetada", bullets: ["Armários superiores e inferiores", "Bancada em quartzo", "Puxadores embutidos"] },
        { title: "Dormitórios", summary: "Closet e painéis personalizados", bullets: ["Guarda-roupa planejado", "Painel de cabeceira", "Bancada de estudo/trabalho"] },
      ],
    },
    {
      id: "equip",
      title: "Equipamentos",
      items: [
        { title: "Louças e metais", summary: "Fornecimento e instalação", bullets: ["Cuba esculpida", "Misturadores monocomando", "Bacia com caixa acoplada"] },
      ],
    },
  ],
  portalTabs: [
    { id: "evolucao", label: "Evolução", bullets: ["Fotos semanais do andamento", "Comparativo antes/depois", "Percentual de conclusão por ambiente"] },
    { id: "documentos", label: "Documentos", bullets: ["Projetos técnicos acessíveis", "Contratos e ART disponíveis", "Memorial descritivo atualizado"] },
    { id: "pagamentos", label: "Pagamentos", bullets: ["Parcelas e vencimentos", "Comprovantes de pagamento", "Extrato financeiro completo"] },
    { id: "cronograma", label: "Cronograma", bullets: ["Fases da obra com datas", "Marcos e entregas parciais", "Alertas de atraso ou antecipação"] },
  ],
};
