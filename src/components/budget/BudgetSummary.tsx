import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { Lock, Shield } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

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
  const sectionSubtotals = sections.map((s: any) => ({
    ...s,
    subtotal: calculateSectionSubtotal(s),
  }));

  const maxSubtotal = Math.max(...sectionSubtotals.map((s) => s.subtotal), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="bg-primary px-6 py-4">
        <h3 className="font-display font-bold text-lg text-primary-foreground">
          Resumo do Orçamento
        </h3>
      </div>

      {/* Sections list */}
      <div className="px-6 pt-5 pb-2">
        <TooltipProvider>
          <div className="space-y-2.5">
            {sectionSubtotals.map((section: any, idx: number) => {
              const tooltipText = getSectionTooltip(section.title);
              const barWidth = Math.max((section.subtotal / maxSubtotal) * 100, 4);
              return (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <motion.button
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      onClick={() => {
                        document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground font-body truncate mr-2 group-hover:text-primary transition-colors">
                          {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}{section.title}
                        </span>
                        <span className="text-sm font-semibold text-foreground font-body whitespace-nowrap">
                          {formatBRL(section.subtotal)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ delay: 0.3 + idx * 0.05, duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-primary/30"
                        />
                      </div>
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[220px]">
                    <p className="text-xs">{tooltipText}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {/* Adjustments */}
      {adjustments.length > 0 && (
        <div className="px-6 pt-2 pb-2 space-y-2">
          <div className="border-t border-border pt-3 space-y-2">
            {adjustments.map((adj: any) => (
              <div key={adj.id} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-body">{adj.label}</span>
                <span className={`text-sm font-medium font-body ${adj.sign > 0 ? 'text-foreground' : 'text-success'}`}>
                  {adj.sign > 0 ? '+' : '-'} {formatBRL(Math.abs(adj.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="mx-6 mt-3 mb-4 rounded-lg bg-primary/5 border border-primary/15 p-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-foreground text-sm">Investimento Total</span>
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="font-display font-extrabold text-2xl text-primary"
          >
            {formatBRL(total)}
          </motion.span>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          <Shield className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs text-muted-foreground font-body">Preço fixo · Sem custos ocultos</span>
        </div>
      </div>

      {/* Footer */}
      {generatedAt && (
        <div className="px-6 pb-4">
          <p className="text-[11px] text-muted-foreground text-center font-body">
            Gerado em {formatDate(generatedAt)}
          </p>
        </div>
      )}
    </motion.div>
  );
}
