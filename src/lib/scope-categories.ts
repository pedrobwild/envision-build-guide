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
    id: "projetos",
    label: "Projetos e Serviços",
    colorClass: "text-primary",
    bgClass: "bg-primary",
    borderClass: "border-l-primary",
    matches: ["projetos", "documentações", "documentacoes", "engenharia", "gestão", "gestao", "impostos", "fretes", "logística", "logistica", "limpeza"],
  },
  {
    id: "infraestrutura",
    label: "Infraestrutura e Instalações",
    colorClass: "text-secondary-foreground",
    bgClass: "bg-secondary",
    borderClass: "border-l-secondary",
    matches: ["serviços civis", "servicos civis", "demolições", "demolicoes", "instalações", "instalacoes", "infraestrutura", "elétrica", "eletrica", "nivelamento"],
  },
  {
    id: "acabamentos",
    label: "Revestimentos e Acabamentos",
    colorClass: "text-accent-foreground",
    bgClass: "bg-accent",
    borderClass: "border-l-accent",
    matches: ["revestimentos", "vinílico", "vinilic", "pinturas", "pintura", "vidros", "espelhos", "luminárias", "luminaria", "acessórios", "acessorios", "bancadas", "granito", "metais", "cortinas", "rodapé", "rodape"],
  },
  {
    id: "marcenaria",
    label: "Marcenaria",
    colorClass: "text-gold",
    bgClass: "bg-gold",
    borderClass: "border-l-gold",
    matches: ["marcenaria"],
  },
  {
    id: "mobiliario",
    label: "Mobiliário",
    colorClass: "text-chart-4",
    bgClass: "bg-chart-4",
    borderClass: "border-l-chart-4",
    matches: ["mobiliário", "mobiliario"],
  },
  {
    id: "eletro",
    label: "Eletroeletrônicos e Eletrodomésticos",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted-foreground",
    borderClass: "border-l-muted-foreground",
    matches: ["eletroeletrônic", "eletroeletronico", "eletrodoméstic", "eletrodomestic"],
  },
];

export function getCategoryForSection(sectionTitle: string): ScopeCategory {
  const lower = (sectionTitle || "").toLowerCase();
  for (const cat of SCOPE_CATEGORIES) {
    if (cat.matches.some((m) => lower.includes(m))) return cat;
  }
  return SCOPE_CATEGORIES[SCOPE_CATEGORIES.length - 1]; // fallback to last category
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
