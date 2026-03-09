import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { CheckCircle2, Lock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

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

function getSectionTooltip(title: string): string {
  const t = (title || "").toLowerCase();
  if (t.includes("projeto") || t.includes("documentaç")) return "Projeto arquitetônico, executivo, ART e gestão documental.";
  if (t.includes("marcenaria")) return "Móveis sob medida projetados para a unidade.";
  if (t.includes("engenharia")) return "Coordenação técnica e gestão da obra.";
  if (t.includes("elétri") || t.includes("eletri")) return "Instalações elétricas e automação.";
  if (t.includes("hidráulic") || t.includes("hidraulic")) return "Instalações hidráulicas e de gás.";
  return "Clique para ver detalhes desta seção.";
}

export function BudgetSummary({ sections, adjustments, total, generatedAt }: BudgetSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display font-bold text-lg text-foreground mb-5">Resumo do Orçamento</h3>


      <TooltipProvider>
        <div className="space-y-3 mb-5">
          {sections.map((section: any) => {
            const subtotal = calculateSectionSubtotal(section);
            const tooltipText = getSectionTooltip(section.title);
            return (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[220px]">
                  <p className="text-xs">{tooltipText}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

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
