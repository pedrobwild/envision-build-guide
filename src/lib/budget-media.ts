export type BudgetMedia = {
  video3d?: string;
  projeto3d: string[];
  projetoExecutivo: string[];
  fotos: string[];
};

const STORAGE_BASE = "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media";

export const BUDGET_MEDIA: Record<string, BudgetMedia> = {
  "f865e54c9a5f": {
    video3d: `${STORAGE_BASE}/f865e54c9a5f/video/video-3d.mp4`,
    projeto3d: [
      `${STORAGE_BASE}/f865e54c9a5f/3d/LM_URBAN_FLEX_16.png`,
    ],
    projetoExecutivo: [],
    fotos: [],
  },
};
