/**
 * Configuration for 3D tours per budget.
 * Each budget can have multiple tours (rooms), each with an iframe URL.
 */
export type Tour3DRoom = {
  id: string;
  label: string;
  url: string;
};

export type Tour3DConfig = {
  rooms: Tour3DRoom[];
};

const TOUR_CONFIGS: Record<string, Tour3DConfig> = {
  fc0761db2d89: {
    rooms: [
      {
        id: "dormitorio",
        label: "Dormitório",
        url: "https://api2.enscape3d.com/v3/view/2644b907-7537-49f2-a373-247c5d6d1976",
      },
      {
        id: "cozinha",
        label: "Cozinha",
        url: "https://api2.enscape3d.com/v3/view/2644b907-7537-49f2-a373-247c5d6d1976",
      },
      {
        id: "banho",
        label: "Banho",
        url: "https://api2.enscape3d.com/v3/view/2644b907-7537-49f2-a373-247c5d6d1976",
      },
    ],
  },
};

export function getTour3DConfig(publicId: string | undefined): Tour3DConfig | null {
  if (!publicId) return null;
  return TOUR_CONFIGS[publicId] ?? null;
}
