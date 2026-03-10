import {
  FileText,
  HardHat,
  Layers,
  Paintbrush,
  Wrench,
  Lightbulb,
  Frame,
  Sparkles,
  Hammer,
  Sofa,
  Tv,
  Bath,
  Package,
  PanelTop,
  Gem,
  type LucideIcon,
} from "lucide-react";

const SECTION_ICON_MAP: { match: string; icon: LucideIcon }[] = [
  { match: "projeto", icon: FileText },
  { match: "documentaç", icon: FileText },
  { match: "civil", icon: HardHat },
  { match: "revestimento", icon: Layers },
  { match: "vinílic", icon: Layers },
  { match: "vinilic", icon: Layers },
  { match: "pintura", icon: Paintbrush },
  { match: "instalaç", icon: Wrench },
  { match: "luminária", icon: Lightbulb },
  { match: "luminaria", icon: Lightbulb },
  { match: "vidro", icon: Frame },
  { match: "espelho", icon: Frame },
  { match: "limpeza", icon: Sparkles },
  { match: "marcenaria", icon: Hammer },
  { match: "mobiliário", icon: Sofa },
  { match: "mobiliario", icon: Sofa },
  { match: "eletroeletrônic", icon: Tv },
  { match: "eletroeletronico", icon: Tv },
  { match: "eletrodoméstic", icon: Tv },
  { match: "eletrodomestic", icon: Tv },
  { match: "banheiro", icon: Bath },
  { match: "cortina", icon: PanelTop },
  { match: "bancada", icon: Gem },
  { match: "granito", icon: Gem },
  { match: "metal", icon: Gem },
];

export function getIconForSection(sectionTitle: string): LucideIcon {
  const lower = (sectionTitle || "").toLowerCase();
  for (const entry of SECTION_ICON_MAP) {
    if (lower.includes(entry.match)) return entry.icon;
  }
  return Package;
}

/**
 * Rotating accent colors for section left-border stripe.
 * Uses semantic design tokens.
 */
export const SECTION_ACCENT_COLORS = [
  "border-l-primary",
  "border-l-success",
  "border-l-warning",
  "border-l-accent-foreground",
  "border-l-gold",
  "border-l-destructive/40",
];

export const SECTION_ICON_BG_COLORS = [
  "bg-primary/10 text-primary",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
  "bg-accent text-accent-foreground",
  "bg-gold/10 text-gold",
  "bg-destructive/10 text-destructive",
];
