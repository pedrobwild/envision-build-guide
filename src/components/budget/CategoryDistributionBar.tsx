import type { CategorizedGroup } from "@/lib/scope-categories";

interface CategoryDistributionBarProps {
  groups: CategorizedGroup[];
  total: number;
}

export function CategoryDistributionBar({ groups, total }: CategoryDistributionBarProps) {
  if (total <= 0) return null;

  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-muted">
      {groups.map((g) => {
        const pct = total > 0 ? (g.subtotal / total) * 100 : 0;
        if (pct <= 0) return null;
        return (
          <div
            key={g.category.id}
            className={`${g.category.bgClass} transition-all duration-500`}
            style={{ width: `${pct}%` }}
            title={`${g.category.label}: ${pct.toFixed(0)}%`}
          />
        );
      })}
    </div>
  );
}
