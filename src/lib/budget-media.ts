export type BudgetMedia = {
  video3d?: string;
  projeto3d: string[];
  projetoExecutivo: string[];
  fotos: string[];
};

const STORAGE_BASE = "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media";

const f865Media: BudgetMedia = {
  video3d: `${STORAGE_BASE}/f865e54c9a5f/video/video-3d.mp4`,
  projeto3d: [
    `${STORAGE_BASE}/f865e54c9a5f/3d/LM_URBAN_FLEX_16.png`,
  ],
  projetoExecutivo: [],
  fotos: [
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(1).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(2).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(3).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(4).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(5).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(6).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(7).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(8).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(9).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(10).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(11).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(12).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(13).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(14).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(15).png`,
    `${STORAGE_BASE}/f865e54c9a5f/LM%20URBAN%20FLEX%20(17).png`,
  ],
};

const media7d9a: BudgetMedia = {
  video3d: `${STORAGE_BASE}/7d9a7b268320/video/video-3d.mp4`,
  projeto3d: [],
  projetoExecutivo: [],
  fotos: [],
};

export const BUDGET_MEDIA: Record<string, BudgetMedia> = {
  "f865e54c9a5f": f865Media,
  "2aa034962039": f865Media,
  "7d9a7b268320": media7d9a,
};
