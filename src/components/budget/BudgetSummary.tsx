import { useRef, useEffect, useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate, formatDateLong, getValidityInfo } from "@/lib/formatBRL";
import { Shield, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CategoryDistributionBar } from "@/components/budget/CategoryDistributionBar";
import { CategoryDetailDialog } from "@/components/budget/CategoryDetailDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface BudgetSummaryProps {
  sections: any[];
  adjustments: any[];
  total: number;
  generatedAt: string;
  budgetDate?: string | null;
  validityDays?: number;
  activeSection?: string | null;
  categorizedGroups?: CategorizedGroup[];
}

export function BudgetSummary({ sections, adjustments, total, generatedAt, budgetDate, validityDays = 30, activeSection, categorizedGroups }: BudgetSummaryProps) {
  const validity = budgetDate ? getValidityInfo(budgetDate, validityDays) : null;

  const sectionElementIds = sections.map((s: any) => `section-${s.id}`);
  const activeIndex = activeSection
    ? sectionElementIds.indexOf(activeSection)
    : -1;

  const progressPercent = activeIndex >= 0
    ? Math.round(((activeIndex + 1) / sectionElementIds.length) * 100)
    : 0;

  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSection]);


  // Dialog for non-displayed categories
  const [detailGroup, setDetailGroup] = useState<CategorizedGroup | null>(null);

  // Categories displayed in main content (cards)
  const DISPLAYED_CATEGORIES = ["marcenaria", "mobiliario", "eletro"];

  const hasCategorized = categorizedGroups && categorizedGroups.length > 0;
  const scopeTotal = categorizedGroups?.reduce((s, g) => s + g.subtotal, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* Validity notice */}
      {validity && (
        <div className={`rounded-xl p-3 flex items-start gap-2.5 ${
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
        {/* Category distribution bar */}
        {hasCategorized && (
          <div className="px-4 pt-3 pb-2">
            <CategoryDistributionBar groups={categorizedGroups} total={scopeTotal} />
          </div>
        )}

        {/* Mini progress bar */}
        {sections.length > 0 && (
          <div className="px-4 pt-2 pb-1">
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

        {/* Grouped sections list */}
        <div className="px-4 pt-4 pb-2">
          {hasCategorized ? (
            <div className="space-y-2">
              {categorizedGroups.map((group) => {
                const isDisplayedInContent = DISPLAYED_CATEGORIES.includes(group.category.id);

                return (
                  <div key={group.category.id}>
                    {/* Group header */}
                    <button
                      onClick={() => {
                        if (isDisplayedInContent) {
                          // Scroll to the first section in this category
                          const firstId = `section-${group.sections[0]?.id}`;
                          document.getElementById(firstId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else {
                          setDetailGroup(group);
                        }
                      }}
                      className="w-full flex items-center gap-2 py-1.5 min-h-[36px]"
                    >
                      <div className={`w-1 h-3.5 rounded-full ${group.category.bgClass}`} />
                      <span className={`text-xs font-display font-bold uppercase tracking-wider ${group.category.colorClass} flex-1 text-left`}>
                        {group.category.label}
                      </span>
                      {!isDisplayedInContent && (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className={`text-xs font-mono tabular-nums font-semibold ${group.category.colorClass}`}>
                        {formatBRL(group.subtotal)}
                      </span>
                    </button>

                  </div>
                );
              })}
            </div>
          ) : (
            // Fallback: flat list for budgets without categorization
            <div className="space-y-0.5">
              {sections.map((section: any, idx: number) => {
                const sectionElId = `section-${section.id}`;
                const isActive = activeSection === sectionElId;
                const subtotal = calculateSectionSubtotal(section);

                return (
                  <button
                    key={section.id}
                    ref={isActive ? activeRef : undefined}
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
                      "text-xs font-body truncate mr-3",
                      isActive ? "text-foreground font-medium" : "text-muted-foreground",
                      "group-hover:text-primary"
                    )}>
                      {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}{section.title}
                    </span>
                    <span className={cn(
                      "text-xs font-mono tabular-nums whitespace-nowrap",
                      isActive ? "text-primary font-semibold" : "text-muted-foreground"
                    )}>
                      {formatBRL(subtotal)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Adjustments */}
        {adjustments.length > 0 && (
          <div className="px-4 pt-1 pb-2 space-y-1">
            <div className="border-t border-border pt-2 space-y-1.5">
              {adjustments.map((adj: any) => (
                <div key={adj.id} className="flex items-center justify-between px-2">
                  <span className="text-xs text-muted-foreground font-body">{adj.label}</span>
                  <span className={`text-xs font-medium font-mono tabular-nums ${adj.sign > 0 ? 'text-foreground' : 'text-success'}`}>
                    {adj.sign > 0 ? '+' : '-'} {formatBRL(Math.abs(adj.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="mx-4 mt-2 mb-3 rounded-xl bg-primary/5 border border-primary/15 p-3.5">
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


        {/* Footer */}
        {generatedAt && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground text-center font-body">
              Gerado em {formatDate(generatedAt)}
            </p>
          </div>
        )}
      </div>

      <CategoryDetailDialog
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        group={detailGroup}
      />
    </motion.div>
  );
}
