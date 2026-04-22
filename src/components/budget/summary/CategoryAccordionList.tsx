import { useState, useMemo } from "react";
import { Layers } from "lucide-react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { CategoryAccordionItem, type CategoryAccordionItemData } from "./CategoryAccordionItem";
import type { CategorizedGroup } from "@/lib/scope-categories";

const LABEL = "budget-label text-[10px] sm:text-[11px] text-muted-foreground/60 tracking-[0.1em] uppercase font-medium";

interface CategoryAccordionListProps {
  categorizedGroups: CategorizedGroup[];
  total: number;
  /** Loading skeleton */
  loading?: boolean;
}

export function CategoryAccordionList({
  categorizedGroups,
  total,
  loading,
}: CategoryAccordionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items: CategoryAccordionItemData[] = useMemo(() =>
    categorizedGroups.flatMap((group) =>
      group.sections.map((section) => {
        const subtotal = calculateSectionSubtotal(section);
        return {
          id: section.id,
          title: section.title,
          subtotal,
          bgClass: group.category.bgClass,
          colorClass: group.category.colorClass,
          percentage: total > 0 ? (subtotal / total) * 100 : 0,
          items: (section.items || []).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
          })),
        };
      })
    ), [categorizedGroups, total]
  );

  const totalSections = items.length;
  const totalItems = items.reduce((acc, s) => acc + s.items.length, 0);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-muted/30" />
          <div className="h-3 w-28 rounded bg-muted/30" />
        </div>
        <div className="rounded-2xl border border-border/30 bg-card p-3 space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-[3px] h-5 rounded-full bg-muted/30" />
              <div className="flex-1 h-4 rounded bg-muted/20" />
              <div className="w-20 h-4 rounded bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-3.5 w-3.5 text-muted-foreground/45 flex-shrink-0" aria-hidden />
          <p className={LABEL}>O que está incluído</p>
        </div>
        <span className="budget-numeric text-[10.5px] sm:text-[11px] text-muted-foreground/55 tracking-[0.02em] whitespace-nowrap tabular-nums">
          <span className="text-foreground/70 font-medium">{totalSections}</span>
          <span className="mx-1 text-muted-foreground/30">categorias</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="ml-1 text-foreground/70 font-medium">{totalItems}</span>
          <span className="ml-1 text-muted-foreground/50">itens</span>
        </span>
      </div>

      {/* Card container */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_2px_-1px_hsl(var(--foreground)/0.04),0_2px_8px_-4px_hsl(var(--foreground)/0.04)]">
        {/* Accordion rows */}
        <div className="divide-y divide-border/[0.08]">
          {items.map((item) => (
            <CategoryAccordionItem
              key={item.id}
              data={item}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === item.id ? null : item.id))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
