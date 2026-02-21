import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";

interface BudgetSummaryProps {
  sections: any[];
  adjustments: any[];
  total: number;
  generatedAt: string;
}

export function BudgetSummary({ sections, adjustments, total, generatedAt }: BudgetSummaryProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-foreground mb-5">Resumo do Orçamento</h3>

      <div className="space-y-3 mb-5">
        {sections.map((section: any) => {
          const subtotal = calculateSectionSubtotal(section);
          return (
            <button
              key={section.id}
              onClick={() => {
                document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="w-full flex items-center justify-between text-left hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
            >
              <span className="text-sm text-foreground font-body truncate mr-2">
                {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}{section.title}
              </span>
              <span className="text-sm font-medium text-foreground font-body whitespace-nowrap">
                {formatBRL(subtotal)}
              </span>
            </button>
          );
        })}
      </div>

      {adjustments.length > 0 && (
        <div className="border-t border-border pt-3 mb-3 space-y-2">
          {adjustments.map((adj: any) => (
            <div key={adj.id} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-body">{adj.label}</span>
              <span className={`text-sm font-medium font-body ${adj.sign > 0 ? 'text-foreground' : 'text-success'}`}>
                {adj.sign > 0 ? '+' : '-'} {formatBRL(Math.abs(adj.amount))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-foreground">Total Final</span>
          <span className="font-display font-bold text-2xl text-primary">{formatBRL(total)}</span>
        </div>
      </div>

      {generatedAt && (
        <p className="mt-4 text-xs text-muted-foreground text-center font-body">
          Gerado em {formatDate(generatedAt)}
        </p>
      )}
    </div>
  );
}
