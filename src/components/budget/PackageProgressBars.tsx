import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";

interface PackageProgressBarsProps {
  sections: any[];
  total: number;
}

export function PackageProgressBars({ sections, total }: PackageProgressBarsProps) {
  if (total <= 0) return null;

  const COLORS = [
    "bg-primary",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-teal-500",
    "bg-orange-500",
  ];

  const data = sections.map((s: any, idx: number) => {
    const subtotal = calculateSectionSubtotal(s);
    const pct = total > 0 ? (subtotal / total) * 100 : 0;
    return { title: s.title, subtotal, pct, color: COLORS[idx % COLORS.length] };
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-8">
      <h3 className="font-display font-bold text-sm text-foreground mb-4">
        Distribuição do Investimento
      </h3>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-muted mb-4">
        {data.map((d, i) => (
          <div
            key={i}
            className={`${d.color} transition-all duration-500`}
            style={{ width: `${d.pct}%` }}
            title={`${d.title}: ${d.pct.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-body">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.color}`} />
            <span className="text-muted-foreground truncate">{d.title}</span>
            <span className="text-foreground font-medium ml-auto whitespace-nowrap">
              {d.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
