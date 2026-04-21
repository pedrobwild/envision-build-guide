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
    fotos: ["/images/projects/level-fb-1.png", "/images/projects/level-fb-2.png", "/images/projects/level-fb-3.png"],
  },
  {
    id: "brk-7",
    empreendimento: "Level Brooklin",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/level-tv-1.png", "/images/projects/level-tv-2.png", "/images/projects/level-tv-3.png"],
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
    fotos: ["/images/projects/hub-apn-1-1.png", "/images/projects/hub-apn-1-2.png", "/images/projects/hub-apn-1-3.png"],
  },
  {
    id: "brk-11",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/hub-apn-2-1.png", "/images/projects/hub-apn-2-2.png", "/images/projects/hub-apn-2-3.png"],
  },
  {
    id: "brk-12",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/hub-me-1.png", "/images/projects/hub-me-2.png", "/images/projects/hub-me-3.png"],
  },
  {
    id: "brk-13",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/hub-le-1.png", "/images/projects/hub-le-2.png", "/images/projects/hub-le-3.png"],
  },
  {
    id: "brk-14",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/hub-ra-1.png", "/images/projects/hub-ra-2.png", "/images/projects/hub-ra-3.png"],
  },
  {
    id: "brk-15",
    empreendimento: "HUB Brooklin by EZ",
    metragem: 25,
    bairro: "Brooklin",
    fotos: ["/images/projects/hub-let-1.png", "/images/projects/hub-let-2.png", "/images/projects/hub-let-3.png"],
  },
  {
    id: "brk-16",
    empreendimento: "ZIP Brooklin",
    metragem: 24,
    bairro: "Brooklin",
    fotos: ["/images/projects/zip-rf-1.png", "/images/projects/zip-rf-2.png", "/images/projects/zip-rf-3.png", "/images/projects/zip-rf-4.png"],
  },
  {
    id: "brk-17",
    empreendimento: "Greenview Brooklin",
    metragem: 20,
    bairro: "Brooklin",
    fotos: ["/images/projects/greenview-1.png", "/images/projects/greenview-2.png", "/images/projects/greenview-3.png"],
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

// Helper: individual project cards (no grouping of photos)
export type IndividualProject = {
  id: string;
  empreendimento: string;
  displayName: string;
  metragem: number;
  bairro: string;
  fotos: string[];
};

export function getIndividualProjects(bairro: string): IndividualProject[] {
  const filtered = brooklinEmpreendimentos.filter(
    (p) => p.bairro.toLowerCase() === bairro.toLowerCase()
  );

  // Count how many projects per empreendimento
  const counts = new Map<string, number>();
  for (const p of filtered) {
    counts.set(p.empreendimento, (counts.get(p.empreendimento) || 0) + 1);
  }

  // Track index per empreendimento for unit suffix
  const indices = new Map<string, number>();

  return filtered.map((p) => {
    const total = counts.get(p.empreendimento) || 1;
    const idx = (indices.get(p.empreendimento) || 0) + 1;
    indices.set(p.empreendimento, idx);

    const displayName = total > 1
      ? `${p.empreendimento} — Und. ${idx}`
      : p.empreendimento;

    return {
      id: p.id,
      empreendimento: p.empreendimento,
      displayName,
      metragem: p.metragem,
      bairro: p.bairro,
      fotos: p.fotos,
    };
  });
}
}
