import { useRef, useEffect, useMemo } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate, formatDateLong, getValidityInfo } from "@/lib/formatBRL";
import { Shield, Clock, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BudgetSummaryProps {
  sections: any[];
  adjustments: any[];
  total: number;
  generatedAt: string;
  budgetDate?: string | null;
  validityDays?: number;
  activeSection?: string | null;
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

export function BudgetSummary({ sections, adjustments, total, generatedAt, budgetDate, validityDays = 30, activeSection }: BudgetSummaryProps) {
  const sectionSubtotals = sections.map((s: any) => ({
    ...s,
    subtotal: calculateSectionSubtotal(s),
  }));

  const validity = budgetDate ? getValidityInfo(budgetDate, validityDays) : null;

  // Determine active index for progress + visited state
  const sectionElementIds = sections.map((s: any) => `section-${s.id}`);
  const activeIndex = activeSection
    ? sectionElementIds.indexOf(activeSection)
    : -1;

  const progressPercent = activeIndex >= 0
    ? Math.round(((activeIndex + 1) / sectionElementIds.length) * 100)
    : 0;

  // Auto-scroll active item into view
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSection]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* Validity notice */}
      {validity && (
        <div className={`rounded-lg p-3 flex items-start gap-2.5 ${
          validity.expired
            ? 'bg-destructive/10 border border-destructive/20'
            : 'bg-warning/10 border border-warning/20'
        }`}>
          {validity.expired ? (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          ) : (
            <Clock className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-xs font-body leading-relaxed ${
            validity.expired ? 'text-destructive' : 'text-foreground'
          }`}>
            {validity.expired
              ? "Valores e condições expirados — solicite uma atualização."
              : `Valores válidos até ${formatDateLong(validity.expiresAt)}.`
            }
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
        {/* Mini progress bar */}
        {sections.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1.5">
              {activeIndex >= 0 ? activeIndex + 1 : 0} de {sections.length} seções
            </p>
          </div>
        )}

        {/* Header */}
        <div className="bg-primary px-5 py-3.5">
          <h3 className="font-display font-bold text-sm text-primary-foreground tracking-wide">
            Resumo do Orçamento
          </h3>
        </div>

        {/* Sections list */}
        <div className="px-4 pt-4 pb-2">
          <TooltipProvider>
            <div className="space-y-0.5">
              {sectionSubtotals.map((section: any, idx: number) => {
                const tooltipText = getSectionTooltip(section.title);
                const sectionElId = `section-${section.id}`;
                const isActive = activeSection === sectionElId;
                const isVisited = activeIndex >= 0 && idx < activeIndex;
                const isNotSeen = activeIndex >= 0 && idx > activeIndex;

                return (
                  <Tooltip key={section.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        ref={isActive ? activeRef : undefined}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02, duration: 0.2 }}
                        onClick={() => {
                          document.getElementById(sectionElId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={cn(
                          "w-full text-left group flex items-center justify-between py-2 px-2 rounded-md transition-all duration-200",
                          isActive && "border-l-2 border-primary bg-primary/5",
                          !isActive && "border-l-2 border-transparent",
                          "hover:bg-muted/50"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-body truncate mr-3 transition-colors duration-200",
                          isActive && "text-foreground font-medium",
                          isVisited && !isActive && "text-foreground",
                          isNotSeen && "text-muted-foreground",
                          !activeSection && "text-foreground",
                          "group-hover:text-primary"
                        )}>
                          {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}{section.title}
                        </span>
                        <span className={cn(
                          "text-xs font-semibold font-body whitespace-nowrap tabular-nums transition-colors duration-200",
                          isActive && "text-primary",
                          isVisited && !isActive && "text-foreground",
                          isNotSeen && "text-muted-foreground",
                          !activeSection && "text-foreground"
                        )}>
                          {formatBRL(section.subtotal)}
                        </span>
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
          <div className="px-4 pt-1 pb-2 space-y-1">
            <div className="border-t border-border pt-2 space-y-1.5">
              {adjustments.map((adj: any) => (
                <div key={adj.id} className="flex items-center justify-between px-2">
                  <span className="text-xs text-muted-foreground font-body">{adj.label}</span>
                  <span className={`text-xs font-medium font-body tabular-nums ${adj.sign > 0 ? 'text-foreground' : 'text-success'}`}>
                    {adj.sign > 0 ? '+' : '-'} {formatBRL(Math.abs(adj.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="mx-4 mt-2 mb-3 rounded-lg bg-primary/5 border border-primary/15 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-foreground text-xs">Investimento Total</span>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="font-display font-extrabold text-xl text-primary tabular-nums"
            >
              {formatBRL(total)}
            </motion.span>
          </div>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Shield className="h-3 w-3 text-primary/60" />
            <span className="text-xs text-muted-foreground font-body">Preço fixo · Sem custos ocultos</span>
          </div>
        </div>

        {/* Predictability mini-card */}
        <button
          onClick={() => document.getElementById("project-security")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="mx-4 mb-3 rounded-lg border border-border hover:border-primary/30 bg-muted/30 hover:bg-primary/[0.03] p-3 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary transition-colors" />
            <span className="text-xs text-muted-foreground font-body">Índice de previsibilidade</span>
          </div>
          <p className="text-xl font-display font-bold text-primary mb-1.5">92%</p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: "92%" }} />
          </div>
        </button>

        {/* Footer */}
        {generatedAt && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground text-center font-body">
              Gerado em {formatDate(generatedAt)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
