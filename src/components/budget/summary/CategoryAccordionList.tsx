import { useState, useMemo } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { CategoryAccordionItem, type CategoryAccordionItemData } from "./CategoryAccordionItem";
import type { CategorizedGroup } from "@/lib/scope-categories";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/50";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

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
          items: (section.items || []).map((item: any) => ({
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
          <p className={LABEL}>O que está incluído</p>
        </div>
        <span
          className="text-[10px] font-mono text-muted-foreground/35 tabular-nums"
          style={MONO_STYLE}
        >
          {totalSections} {totalSections === 1 ? "categoria" : "categorias"} · {totalItems} itens
        </span>
      </div>

      {/* Card container */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Distribution bar */}
        <div className="px-3 pt-3 pb-1" aria-hidden>
          <div className="flex h-[3px] rounded-full overflow-hidden bg-muted/30">
            {items.map((s) => {
              if (s.percentage <= 0) return null;
              return (
                <div
                  key={s.id}
                  className={cn("transition-all duration-500", s.bgClass)}
                  style={{ width: `${s.percentage}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Accordion rows */}
        <div className="divide-y divide-border/[0.06]">
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
