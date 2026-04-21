/**
 * Inteligência de mercado por bairro de São Paulo.
 * Dados Bwild/AirDNA 2025 + seeds — não inventar valores; apenas estender.
 */

export type DemandChip =
  | "Misto"
  | "Corporativo"
  | "Turismo"
  | "Turismo Premium"
  | "Eventos"
  | "Hospitais"
  | "Universidades"
  | "Próximo ao metrô";

export type CompetitionChip = "Baixa" | "Média" | "Alta";

export type DistrictRow = {
  districtName: string;
  score: number;
  chips: DemandChip[];
  roiPercent: number;
  nightlyRateBRL: number;
  occupancyPercent: number;
  revenueMonthBRL: number;
  adrRangeLabel: string;
  listingsCount: number;
  priceSqm: number;
  /** Valorização anual típica do m² (FipeZap 12m) — % a.a. (opcional) */
  appreciationPctYear?: number;
  /** Receita típica por mês (12 valores) — sazonalidade jan→dez */
  seasonality?: number[];
  competition: CompetitionChip;
  sourceLabel: string;
  recommendation: {
    bestStudioType: string;
    whyItWorks: string;
    tips: string[];
    risks: string[];
  };
};

/** Sazonalidade padrão SP — alta no inverno (jun-ago: eventos, frio) e dezembro (festas) */
export const DEFAULT_SEASONALITY = [
  0.85, 0.78, 0.92, 1.0, 1.05, 1.15, 1.2, 1.18, 1.05, 1.0, 0.95, 1.07,
];

export const DISTRICTS_MOCK: DistrictRow[] = [
  {
    districtName: "Pinheiros",
    score: 92,
    chips: ["Misto", "Turismo", "Próximo ao metrô"],
    roiPercent: 19.2,
    nightlyRateBRL: 410,
    occupancyPercent: 75,
    revenueMonthBRL: 9225,
    adrRangeLabel: "R$340–R$480",
    listingsCount: 1850,
    priceSqm: 14000,
    competition: "Alta",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Compacto premium + home office",
      whyItWorks: "Alta demanda mista (turismo + corporativo), vida noturna forte e ótima mobilidade.",
      tips: [
        "Foto de capa impecável e descrição focada em lifestyle",
        "Wi-Fi excelente e setup para nômades digitais",
        "Check-in autônomo e self-service",
      ],
      risks: [
        "Competição alta exige reviews 5★ consistentes",
        "Atenção a ruído noturno em ruas movimentadas",
      ],
    },
  },
  {
    districtName: "Itaim Bibi",
    score: 91,
    chips: ["Corporativo", "Próximo ao metrô"],
    roiPercent: 18.1,
    nightlyRateBRL: 440,
    occupancyPercent: 73,
    revenueMonthBRL: 9636,
    adrRangeLabel: "R$360–R$520",
    listingsCount: 1620,
    priceSqm: 16000,
    competition: "Alta",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Business studio (hotel feel)",
      whyItWorks: "Público corporativo valoriza previsibilidade, conforto e experiência padrão hotel.",
      tips: [
        "Mesa de trabalho confortável + monitor extra opcional",
        "Cafeteria de qualidade e enxoval branco premium",
        "Mid-stay (7–28 noites) com tarifa progressiva",
      ],
      risks: [
        "Sazonalidade corporativa — feriados e dezembro caem",
        "Concorrência com hotéis exige diferenciação clara",
      ],
    },
  },
  {
    districtName: "Jardim Paulista",
    score: 87,
    chips: ["Turismo Premium", "Turismo", "Próximo ao metrô"],
    roiPercent: 17.4,
    nightlyRateBRL: 440,
    occupancyPercent: 70,
    revenueMonthBRL: 9240,
    adrRangeLabel: "R$360–R$520",
    listingsCount: 1480,
    priceSqm: 15000,
    competition: "Alta",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Premium boutique com design assinado",
      whyItWorks: "Turismo de alto poder aquisitivo busca acabamento refinado próximo a Paulista e shoppings.",
      tips: [
        "Acabamento e iluminação cênica fazem diferença",
        "Texto em inglês e português no anúncio",
        "Concierge digital e dicas de bairro",
      ],
      risks: [
        "Ticket alto exige presentation impecável",
        "Cancelamentos last-minute em alta temporada",
      ],
    },
  },
  {
    districtName: "Consolação",
    score: 86,
    chips: ["Turismo", "Próximo ao metrô"],
    roiPercent: 16.6,
    nightlyRateBRL: 390,
    occupancyPercent: 74,
    revenueMonthBRL: 8660,
    adrRangeLabel: "R$320–R$470",
    listingsCount: 1210,
    priceSqm: 10500,
    competition: "Alta",
    sourceLabel: "Seed (substituir por dados reais)",
    recommendation: {
      bestStudioType: "Compacto urbano para jovens viajantes",
      whyItWorks: "Localização central com vida noturna e fácil acesso à Paulista atrai turismo jovem.",
      tips: [
        "Janela acústica é essencial",
        "Decor moderno e Instagram-friendly",
        "Promova proximidade da Paulista e do MASP",
      ],
      risks: [
        "Ruído de via expressa em alguns trechos",
        "Hóspedes festivos exigem regras claras",
      ],
    },
  },
  {
    districtName: "Bela Vista",
    score: 82,
    chips: ["Turismo", "Próximo ao metrô"],
    roiPercent: 15.4,
    nightlyRateBRL: 360,
    occupancyPercent: 72,
    revenueMonthBRL: 7776,
    adrRangeLabel: "R$290–R$430",
    listingsCount: 980,
    priceSqm: 9500,
    competition: "Alta",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Compacto eficiente para curta estadia",
      whyItWorks: "Centro com boa malha de transporte e demanda turística constante.",
      tips: [
        "Capriche em fotos diurnas e iluminação",
        "Comunicação clara sobre check-in e regras",
        "Detalhes brasileiros valorizam o anúncio",
      ],
      risks: [
        "Saturação local pressiona tarifa",
        "Manutenção predial pode afetar avaliações",
      ],
    },
  },
  {
    districtName: "Moema",
    score: 85,
    chips: ["Misto", "Próximo ao metrô"],
    roiPercent: 15.8,
    nightlyRateBRL: 380,
    occupancyPercent: 70,
    revenueMonthBRL: 7980,
    adrRangeLabel: "R$310–R$460",
    listingsCount: 1150,
    priceSqm: 14500,
    competition: "Média",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Família + business mix",
      whyItWorks: "Bairro residencial valorizado, próximo a parques e aeroporto, atrai mix família/corporativo.",
      tips: [
        "Cama queen + sofá-cama amplia público",
        "Berço/cadeirinha como amenidade extra",
        "Estacionamento é diferencial",
      ],
      risks: [
        "Ocupação cai em janeiro/fevereiro",
        "Condomínios podem restringir locação curta",
      ],
    },
  },
  {
    districtName: "Vila Mariana",
    score: 83,
    chips: ["Hospitais", "Universidades", "Próximo ao metrô"],
    roiPercent: 15.2,
    nightlyRateBRL: 350,
    occupancyPercent: 71,
    revenueMonthBRL: 7455,
    adrRangeLabel: "R$280–R$420",
    listingsCount: 1080,
    priceSqm: 12500,
    competition: "Média",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Mid-stay para acompanhantes médicos e estudantes",
      whyItWorks: "Proximidade do Hospital São Paulo e da UNIFESP gera demanda contínua de média estadia.",
      tips: [
        "Ofereça desconto progressivo a partir de 14 noites",
        "Cozinha equipada e máquina de lavar",
        "Comunicação humanizada (acompanhantes em momento sensível)",
      ],
      risks: [
        "Tarifa diária menor exige eficiência operacional",
        "Cancelamentos médicos de última hora",
      ],
    },
  },
  {
    districtName: "Barra Funda",
    score: 80,
    chips: ["Eventos", "Próximo ao metrô"],
    roiPercent: 14.8,
    nightlyRateBRL: 340,
    occupancyPercent: 68,
    revenueMonthBRL: 6936,
    adrRangeLabel: "R$260–R$420",
    listingsCount: 720,
    priceSqm: 8500,
    competition: "Média",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Eventos & shows (Allianz Parque, Memorial)",
      whyItWorks: "Calendário de eventos no Allianz e arredores cria picos de demanda recorrentes.",
      tips: [
        "Tarifa dinâmica em datas de evento",
        "Comunicação sobre acesso a Allianz/Memorial",
        "Check-in flexível para shows à noite",
      ],
      risks: [
        "Vacância nas semanas sem evento",
        "Dependência de calendário de terceiros",
      ],
    },
  },
  {
    districtName: "Campo Belo",
    score: 84,
    chips: ["Corporativo"],
    roiPercent: 15.0,
    nightlyRateBRL: 370,
    occupancyPercent: 69,
    revenueMonthBRL: 7659,
    adrRangeLabel: "R$300–R$460",
    listingsCount: 690,
    priceSqm: 13000,
    competition: "Média",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Business mid-stay próximo a Congonhas",
      whyItWorks: "Proximidade do aeroporto e de polos corporativos gera demanda de dias úteis.",
      tips: [
        "Translado/Uber facilitado para Congonhas",
        "Café da manhã self-service no quarto",
        "Tarifa dinâmica em dias úteis",
      ],
      risks: [
        "Fins de semana têm ocupação menor",
        "Concorrência com hotéis aeroportuários",
      ],
    },
  },
  {
    districtName: "República",
    score: 79,
    chips: ["Turismo", "Próximo ao metrô"],
    roiPercent: 13.6,
    nightlyRateBRL: 300,
    occupancyPercent: 67,
    revenueMonthBRL: 6030,
    adrRangeLabel: "R$230–R$380",
    listingsCount: 1320,
    priceSqm: 8200,
    competition: "Alta",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Compacto turístico de entrada",
      whyItWorks: "Mochileiros e turismo de orçamento usam o centro como base de fácil acesso.",
      tips: [
        "Segurança visível (fechadura, cofre)",
        "Comunicação multilíngue no anúncio",
        "Dicas de bairro e segurança",
      ],
      risks: [
        "Percepção de segurança pode pesar nas reviews",
        "Saturação puxa tarifa para baixo",
      ],
    },
  },
  {
    districtName: "Santana",
    score: 81,
    chips: ["Misto", "Próximo ao metrô"],
    roiPercent: 14.0,
    nightlyRateBRL: 310,
    occupancyPercent: 66,
    revenueMonthBRL: 6138,
    adrRangeLabel: "R$240–R$390",
    listingsCount: 540,
    priceSqm: 9000,
    competition: "Média",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Família + acesso ao Expo Center Norte",
      whyItWorks: "Demanda de eventos no Expo Center Norte combinada a turismo familiar zona norte.",
      tips: [
        "Estacionamento e acesso a feiras/eventos",
        "Cama de casal + opção familiar",
        "Indicar Parque da Juventude e shoppings",
      ],
      risks: [
        "Picos atrelados ao calendário de feiras",
        "Distância do centro turístico",
      ],
    },
  },
  {
    districtName: "Vila Olímpia",
    score: 89,
    chips: ["Corporativo", "Misto", "Próximo ao metrô"],
    roiPercent: 17.0,
    nightlyRateBRL: 410,
    occupancyPercent: 74,
    revenueMonthBRL: 9102,
    adrRangeLabel: "R$340–R$480",
    listingsCount: 1280,
    priceSqm: 15500,
    competition: "Alta",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Business premium + lifestyle",
      whyItWorks: "Polo corporativo da Faria Lima estendido, com vida noturna e gastronomia próximas.",
      tips: [
        "Setup hotel (enxoval branco, robe, amenities)",
        "Mid-stay corporativo com tarifa progressiva",
        "Foto noturna do skyline",
      ],
      risks: [
        "Tarifa cai em dezembro/janeiro",
        "Competição alta exige operação afiada",
      ],
    },
  },
  {
    districtName: "Vila Madalena",
    score: 88,
    chips: ["Turismo", "Misto", "Próximo ao metrô"],
    roiPercent: 16.5,
    nightlyRateBRL: 390,
    occupancyPercent: 72,
    revenueMonthBRL: 8424,
    adrRangeLabel: "R$320–R$460",
    listingsCount: 1340,
    priceSqm: 13000,
    competition: "Média",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Boutique com identidade local",
      whyItWorks: "Bairro boêmio/turístico atrai público que busca personalidade e arte de rua.",
      tips: [
        "Decor autoral, arte local, vinil/livros",
        "Roteiros caminháveis no anúncio",
        "Parceria com bares e cafés do bairro",
      ],
      risks: [
        "Ruído nas ruas de bar (sex/sáb)",
        "Estacionamento escasso",
      ],
    },
  },
  {
    districtName: "Liberdade",
    score: 84,
    chips: ["Turismo", "Próximo ao metrô"],
    roiPercent: 15.0,
    nightlyRateBRL: 340,
    occupancyPercent: 70,
    revenueMonthBRL: 7140,
    adrRangeLabel: "R$270–R$410",
    listingsCount: 870,
    priceSqm: 9800,
    competition: "Média",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Compacto temático para turismo cultural",
      whyItWorks: "Bairro cultural asiático com fluxo turístico constante e proximidade do centro histórico.",
      tips: [
        "Anúncio em japonês/inglês amplia público",
        "Roteiros gastronômicos no welcome guide",
        "Mantenha decor sóbrio e funcional",
      ],
      risks: [
        "Movimento intenso aos fins de semana",
        "Manutenção predial em prédios antigos",
      ],
    },
  },
  {
    districtName: "Vila Clementino",
    score: 83,
    chips: ["Hospitais", "Universidades", "Próximo ao metrô"],
    roiPercent: 15.2,
    nightlyRateBRL: 350,
    occupancyPercent: 71,
    revenueMonthBRL: 7455,
    adrRangeLabel: "R$280–R$420",
    listingsCount: 620,
    priceSqm: 11500,
    competition: "Baixa",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Mid-stay médico/acadêmico",
      whyItWorks: "Hospital São Paulo, UNIFESP e centros de pesquisa garantem estadias de 7–60 dias.",
      tips: [
        "Cozinha completa e área de trabalho",
        "Tarifa por semana e por mês",
        "Política de pets cuidadosa amplia público",
      ],
      risks: [
        "Picos sazonais de internação fora do controle",
        "Tarifas mensais reduzem RevPAR diário",
      ],
    },
  },
  {
    districtName: "Brooklin",
    score: 80,
    chips: ["Corporativo", "Misto"],
    roiPercent: 12.1,
    nightlyRateBRL: 290,
    occupancyPercent: 60,
    revenueMonthBRL: 5292,
    adrRangeLabel: "R$240–R$350",
    listingsCount: 480,
    priceSqm: 12500,
    competition: "Média",
    sourceLabel: "Bwild/AirDNA 2025",
    recommendation: {
      bestStudioType: "Business premium + estadias médias",
      whyItWorks: "Região corporativa em crescimento com baixa saturação e bom potencial de valorização.",
      tips: [
        "Mid-stay 14–60 noites é o sweet spot",
        "Mesa de trabalho profissional + cadeira ergonômica",
        "Parceria com empresas locais",
      ],
      risks: [
        "Mercado ainda em maturação — variação maior",
        "Fins de semana com ocupação fraca",
      ],
    },
  },
  {
    districtName: "Itaquera",
    score: 78,
    chips: ["Eventos", "Próximo ao metrô"],
    roiPercent: 13.2,
    nightlyRateBRL: 260,
    occupancyPercent: 62,
    revenueMonthBRL: 4836,
    adrRangeLabel: "R$190–R$320",
    listingsCount: 320,
    priceSqm: 6500,
    competition: "Baixa",
    sourceLabel: "Seed",
    recommendation: {
      bestStudioType: "Eventos (Arena Corinthians) + entrada acessível",
      whyItWorks: "Arena Corinthians e proximidade do metrô criam picos de demanda em jogos e shows.",
      tips: [
        "Tarifa dinâmica colada ao calendário do estádio",
        "Comunicação clara sobre transporte e acesso",
        "Check-in flexível pós-evento",
      ],
      risks: [
        "Vacância alta entre eventos",
        "Tarifa diária menor exige operação enxuta",
      ],
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeBairro(input?: string | null): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const ALIASES: Record<string, string> = {
  "jardins": "Jardim Paulista",
  "jd paulista": "Jardim Paulista",
  "jd. paulista": "Jardim Paulista",
  "itaim": "Itaim Bibi",
  "vila olimpia": "Vila Olímpia",
  "consolacao": "Consolação",
  "republica": "República",
};

export function findDistrict(bairro?: string | null): DistrictRow | null {
  const norm = normalizeBairro(bairro);
  if (!norm) return null;

  // 1. Match exato normalizado
  const exact = DISTRICTS_MOCK.find((d) => normalizeBairro(d.districtName) === norm);
  if (exact) return exact;

  // 2. Aliases
  const aliasTarget = ALIASES[norm];
  if (aliasTarget) {
    const aliased = DISTRICTS_MOCK.find((d) => d.districtName === aliasTarget);
    if (aliased) return aliased;
  }

  // 3. Match parcial (contém)
  const partial = DISTRICTS_MOCK.find((d) => {
    const dn = normalizeBairro(d.districtName);
    return dn.includes(norm) || norm.includes(dn);
  });
  return partial || null;
}

const _avg = (key: keyof Pick<DistrictRow, "nightlyRateBRL" | "occupancyPercent" | "revenueMonthBRL" | "roiPercent">) =>
  Math.round(DISTRICTS_MOCK.reduce((sum, d) => sum + d[key], 0) / DISTRICTS_MOCK.length);

export const AVERAGE_METRICS = {
  nightlyRateBRL: _avg("nightlyRateBRL"),
  occupancyPercent: _avg("occupancyPercent"),
  revenueMonthBRL: _avg("revenueMonthBRL"),
  roiPercent: Number((DISTRICTS_MOCK.reduce((s, d) => s + d.roiPercent, 0) / DISTRICTS_MOCK.length).toFixed(1)),
};

export const formatBRLCompact = (v: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Math.round(v));

export const formatPct = (v: number): string =>
  `${v.toFixed(1).replace(".", ",")}%`;
