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

function normalizeCategoryText(value: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const SCOPE_CATEGORIES: ScopeCategory[] = [
  {
    id: "projetos",
    label: "Projetos e Serviços",
    colorClass: "text-primary",
    bgClass: "bg-primary",
    borderClass: "border-l-primary",
    matches: ["projetos", "projeto arquitet", "documentações", "documentacoes", "engenharia", "gestão", "gestao", "impostos", "frete", "fretes", "logística", "logistica", "limpeza"],
  },
  {
    id: "infraestrutura",
    label: "Infraestrutura e Civil",
    colorClass: "text-charcoal-light",
    bgClass: "bg-charcoal-light",
    borderClass: "border-l-charcoal-light",
    matches: ["serviços civis", "servicos civis", "demolições", "demolicoes", "instalações", "instalacoes", "infraestrutura", "elétrica", "eletrica", "nivelamento"],
  },
  {
    id: "acabamentos",
    label: "Revestimentos",
    colorClass: "text-accent-foreground",
    bgClass: "bg-accent-foreground",
    borderClass: "border-l-accent-foreground",
    matches: ["revestimentos", "vinílico", "vinilic", "pinturas", "pintura", "vidros", "vidraçaria", "vidracaria", "espelhos", "luminárias", "luminaria", "acessórios", "acessorios", "bancadas", "granito", "metais", "cortinas", "rodapé", "rodape"],
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
    colorClass: "text-success",
    bgClass: "bg-success",
    borderClass: "border-l-success",
    matches: ["mobiliário", "mobiliario"],
  },
  {
    id: "eletro",
    label: "Eletrodomésticos",
    colorClass: "text-warning",
    bgClass: "bg-warning",
    borderClass: "border-l-warning",
    matches: ["eletroeletrônic", "eletroeletronico", "eletrodoméstic", "eletrodomestic"],
  },
  {
    id: "decoracao",
    label: "Decoração",
    colorClass: "text-rose-500",
    bgClass: "bg-rose-500",
    borderClass: "border-l-rose-500",
    matches: ["decoração", "decoracao", "decoraçao", "decor"],
  },
  {
    id: "utensilios",
    label: "Utensílios",
    colorClass: "text-cyan-600",
    bgClass: "bg-cyan-600",
    borderClass: "border-l-cyan-600",
    matches: ["utensílios", "utensilios", "utensilio", "hospede", "enxoval"],
  },
  {
    id: "outros",
    label: "Outros",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted-foreground",
    borderClass: "border-l-muted-foreground",
    matches: [],
  },
];

const FALLBACK_CATEGORY = SCOPE_CATEGORIES[SCOPE_CATEGORIES.length - 1]; // "Outros"

export function getCategoryForSection(sectionTitle: string): ScopeCategory {
  const normalizedTitle = normalizeCategoryText(sectionTitle);
  for (const cat of SCOPE_CATEGORIES) {
    if (cat.matches.length > 0 && cat.matches.some((m) => normalizedTitle.includes(normalizeCategoryText(m)))) return cat;
  }
  return FALLBACK_CATEGORY;
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
