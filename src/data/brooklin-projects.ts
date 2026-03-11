// Legacy type kept for backward compatibility with existing components
export type ProjetoBairro = {
  id: string;
  titulo: string;
  metragem: string;
  cep: string;
  bairro: string;
  lat: number;
  lng: number;
  fotos: string[];
};

export type EmpreendimentoProject = {
  id: string;
  empreendimento: string;
  metragem: number;
  bairro: string;
  fotos: string[];
};

// Projetos agrupados por empreendimento — dados reais do Brooklin
// Sem nomes de clientes, apenas empreendimento + metragem + fotos
export const brooklinEmpreendimentos: EmpreendimentoProject[] = [
  {
    id: "brk-1",
    empreendimento: "My One Brooklin",
    metragem: 28,
    bairro: "Brooklin",
    fotos: ["/images/projects/myone-1.jpg", "/images/projects/myone-2.jpg", "/images/projects/myone-3.jpg"],
  },
  {
    id: "brk-2",
    empreendimento: "Atmosfera Studio 360",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/atmosfera-1.png", "/images/projects/atmosfera-2.png", "/images/projects/atmosfera-3.png"],
  },
  {
    id: "brk-3",
    empreendimento: "Metrocasa Berrini",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/metrocasa-rj-1.png", "/images/projects/metrocasa-rj-2.png", "/images/projects/metrocasa-rj-3.png"],
  },
  {
    id: "brk-4",
    empreendimento: "Metrocasa Berrini",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/metrocasa-pr-1.png", "/images/projects/metrocasa-pr-2.png", "/images/projects/metrocasa-pr-3.png"],
  },
  {
    id: "brk-5",
    empreendimento: "Metrocasa Berrini",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/metrocasa-ta-1.png", "/images/projects/metrocasa-ta-2.png", "/images/projects/metrocasa-ta-3.png"],
  },
  {
    id: "brk-6",
    empreendimento: "Level Brooklin",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-7.jpg", "/images/projects/studio-1.jpg", "/images/projects/studio-4.jpg"],
  },
  {
    id: "brk-7",
    empreendimento: "Level Brooklin",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-1.jpg", "/images/projects/studio-6.jpg", "/images/projects/studio-2.jpg"],
  },
  {
    id: "brk-8",
    empreendimento: "Level Brooklin",
    metragem: 36,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-7.jpg", "/images/projects/studio-5.jpg", "/images/projects/studio-3.jpg"],
  },
  {
    id: "brk-9",
    empreendimento: "Level Brooklin",
    metragem: 24.4,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-2.jpg", "/images/projects/studio-4.jpg", "/images/projects/studio-1.jpg"],
  },
  {
    id: "brk-10",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-3.jpg", "/images/projects/studio-5.jpg", "/images/projects/studio-7.jpg"],
  },
  {
    id: "brk-11",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-4.jpg", "/images/projects/studio-6.jpg", "/images/projects/studio-1.jpg"],
  },
  {
    id: "brk-12",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-5.jpg", "/images/projects/studio-7.jpg", "/images/projects/studio-2.jpg"],
  },
  {
    id: "brk-13",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-6.jpg", "/images/projects/studio-3.jpg", "/images/projects/studio-4.jpg"],
  },
  {
    id: "brk-14",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-1.jpg", "/images/projects/studio-2.jpg", "/images/projects/studio-7.jpg"],
  },
  {
    id: "brk-15",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-2.jpg", "/images/projects/studio-5.jpg", "/images/projects/studio-6.jpg"],
  },
  {
    id: "brk-16",
    empreendimento: "ZIP Brooklin",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-3.jpg", "/images/projects/studio-1.jpg", "/images/projects/studio-5.jpg"],
  },
  {
    id: "brk-17",
    empreendimento: "Greenview Brooklin",
    metragem: 20,
    bairro: "Brooklin",
    fotos: ["/images/projects/studio-4.jpg", "/images/projects/studio-7.jpg", "/images/projects/studio-6.jpg"],
  },
];

// Helper: group projects by empreendimento
export type EmpreendimentoGroup = {
  name: string;
  projectCount: number;
  metragens: number[];
  allFotos: string[][];
};

export function groupByEmpreendimento(bairro: string): EmpreendimentoGroup[] {
  const filtered = brooklinEmpreendimentos.filter(
    (p) => p.bairro.toLowerCase() === bairro.toLowerCase()
  );

  const groups = new Map<string, { metragens: number[]; fotos: string[][] }>();

  for (const p of filtered) {
    const existing = groups.get(p.empreendimento);
    if (existing) {
      existing.metragens.push(p.metragem);
      existing.fotos.push(p.fotos);
    } else {
      groups.set(p.empreendimento, {
        metragens: [p.metragem],
        fotos: [p.fotos],
      });
    }
  }

  return Array.from(groups.entries()).map(([name, data]) => ({
    name,
    projectCount: data.metragens.length,
    metragens: data.metragens,
    allFotos: data.fotos,
  }));
}
