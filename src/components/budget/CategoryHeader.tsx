import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import type { ScopeCategory } from "@/lib/scope-categories";

interface CategoryHeaderProps {
  category: ScopeCategory;
  subtotal: number;
  sectionCount?: number;
  itemCount?: number;
}

export function CategoryHeader({ category, subtotal, sectionCount, itemCount }: CategoryHeaderProps) {
  return (
    <div className="mt-5 sm:mt-8 first:mt-0 mb-2 sm:mb-3">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn("w-1 self-stretch rounded-full", category.bgClass)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-sm sm:text-base font-display font-bold tracking-tight", category.colorClass)}>
              {category.label}
            </span>
            <span className="font-display font-bold text-sm sm:text-base text-foreground tabular-nums flex-shrink-0">
              {formatBRL(subtotal)}
            </span>
          </div>
          {(sectionCount || itemCount) && (
            <p className="text-[11px] sm:text-xs text-muted-foreground font-body mt-0.5">
              {sectionCount && sectionCount > 0 && `${sectionCount} ${sectionCount === 1 ? 'seção' : 'seções'}`}
              {sectionCount && itemCount ? ' · ' : ''}
              {itemCount && itemCount > 0 && `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
