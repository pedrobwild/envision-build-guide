import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { CheckCircle2, Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const includedItems = [
  "Projeto arquitetônico",
  "Engenharia e gestão",
  "Execução da obra",
  "Materiais e equipamentos",
  "Acompanhamento digital",
  "Garantia de 5 anos",
];

interface BudgetSummaryProps {
  sections: any[];
  adjustments: any[];
  total: number;
  generatedAt: string;
}

export function BudgetSummary({ sections, adjustments, total, generatedAt }: BudgetSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-foreground mb-5">Resumo do Orçamento</h3>

      {/* What's included */}
      <div className="mb-4 space-y-2">
        <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">O que está incluso neste valor</p>
        <ul className="space-y-1.5">
          {includedItems.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs font-body text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator className="mb-4" />

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
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-body">Sem custos ocultos</span>
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
