import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import type { BudgetSection } from "@/types/budget";

export interface ScopeCategory {
  id: string;
  label: string;
  colorClass: string;        // tailwind text color
  bgClass: string;            // tailwind bg for bar/badges
  borderClass: string;        // border-l color
  matches: string[];
}

export const SCOPE_CATEGORIES: ScopeCategory[] = [
  {
    id: "civil",
    label: "Obra Civil",
    colorClass: "text-primary",
    bgClass: "bg-primary",
    borderClass: "border-l-primary",
    matches: ["serviços civis", "pinturas", "instalações"],
  },
  {
    id: "acabamentos",
    label: "Acabamentos",
    colorClass: "text-secondary-foreground",
    bgClass: "bg-secondary",
    borderClass: "border-l-secondary",
    matches: ["revestimentos", "vinílico", "vinilic", "luminárias", "luminaria", "vidros", "espelhos", "bancadas", "granito", "metais", "cortinas"],
  },
  {
    id: "mobiliario",
    label: "Mobiliário & Equipamentos",
    colorClass: "text-gold",
    bgClass: "bg-gold",
    borderClass: "border-l-gold",
    matches: ["marcenaria", "mobiliário", "mobiliario", "eletroeletrônic", "eletroeletronico", "eletrodoméstic", "eletrodomestic"],
  },
  {
    id: "complementos",
    label: "Complementos",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted-foreground",
    borderClass: "border-l-muted-foreground",
    matches: ["acessórios", "acessorios", "limpeza"],
  },
];

export function getCategoryForSection(sectionTitle: string): ScopeCategory {
  const lower = (sectionTitle || "").toLowerCase();
  for (const cat of SCOPE_CATEGORIES) {
    if (cat.matches.some((m) => lower.includes(m))) return cat;
  }
  return SCOPE_CATEGORIES[3]; // fallback to complementos
}

export interface CategorizedGroup {
  category: ScopeCategory;
  sections: BudgetSection[];
  subtotal: number;
}

export function categorizeSections(sections: BudgetSection[]): CategorizedGroup[] {
  const groups: Map<string, CategorizedGroup> = new Map();

  // Initialize all categories in order
  for (const cat of SCOPE_CATEGORIES) {
    groups.set(cat.id, { category: cat, sections: [], subtotal: 0 });
  }

  for (const section of sections) {
    const cat = getCategoryForSection(section.title);
    const group = groups.get(cat.id)!;
    group.sections.push(section);
    group.subtotal += calculateSectionSubtotal(section);
  }

  // Return only non-empty groups, in order
  return SCOPE_CATEGORIES
    .map((cat) => groups.get(cat.id)!)
    .filter((g) => g.sections.length > 0);
}
