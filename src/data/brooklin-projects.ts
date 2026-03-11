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

export const brooklinProjects: ProjetoBairro[] = [
  {
    id: "1",
    titulo: "Projeto Brooklin 180",
    metragem: "180 m²",
    cep: "04571-000",
    bairro: "Brooklin",
    lat: -23.6245,
    lng: -46.6962,
    fotos: [
      "/images/brooklin-1-1.jpg",
      "/images/brooklin-1-2.jpg",
      "/images/brooklin-1-3.jpg",
      "/images/brooklin-1-4.jpg",
    ],
  },
  {
    id: "2",
    titulo: "Projeto Brooklin 220",
    metragem: "220 m²",
    cep: "04570-001",
    bairro: "Brooklin",
    lat: -23.6228,
    lng: -46.6904,
    fotos: [
      "/images/brooklin-2-1.jpg",
      "/images/brooklin-2-2.jpg",
      "/images/brooklin-2-3.jpg",
      "/images/brooklin-2-4.jpg",
    ],
  },
  {
    id: "3",
    titulo: "Projeto Brooklin House",
    metragem: "145 m²",
    cep: "04571-110",
    bairro: "Brooklin",
    lat: -23.6261,
    lng: -46.6948,
    fotos: [
      "/images/brooklin-3-1.jpg",
      "/images/brooklin-3-2.jpg",
      "/images/brooklin-3-3.jpg",
      "/images/brooklin-3-4.jpg",
    ],
  },
];
