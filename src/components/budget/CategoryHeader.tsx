import { formatBRL } from "@/lib/formatBRL";
import type { ScopeCategory } from "@/lib/scope-categories";

interface CategoryHeaderProps {
  category: ScopeCategory;
  subtotal: number;
}

export function CategoryHeader({ category, subtotal }: CategoryHeaderProps) {
  return (
    <div className="mt-8 first:mt-0 mb-2 flex items-center gap-2.5">
      <div className={`w-1 h-4 rounded-full ${category.bgClass}`} />
      <span className={`text-base font-display font-bold uppercase tracking-wider ${category.colorClass}`}>
        {category.label}
      </span>
      <span className="ml-auto text-base font-mono font-bold tabular-nums text-foreground">
        {formatBRL(subtotal)}
      </span>
    </div>
  );
}
