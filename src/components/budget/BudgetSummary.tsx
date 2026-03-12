import { useRef, useEffect, useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate, formatDateLong, getValidityInfo } from "@/lib/formatBRL";
import { Shield, Clock, AlertTriangle } from "lucide-react";
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

export function BudgetSummary({
  sections,
  adjustments,
  total,
  generatedAt,
  budgetDate,
  validityDays = 30,
  activeSection,
  categorizedGroups,
}: BudgetSummaryProps) {
  const validity = budgetDate ? getValidityInfo(budgetDate, validityDays) : null;

  const sectionElementIds = sections.map((s: any) => `section-${s.id}`);
  const activeIndex = activeSection
    ? sectionElementIds.indexOf(activeSection)
    : -1;

  const progressPercent =
    activeIndex >= 0
      ? Math.round(((activeIndex + 1) / sectionElementIds.length) * 100)
      : 0;

  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSection]);

  const [detailGroup, setDetailGroup] = useState<CategorizedGroup | null>(null);

  const DISPLAYED_CATEGORIES = ["marcenaria", "mobiliario", "eletro"];

  const hasCategorized = categorizedGroups && categorizedGroups.length > 0;
  const scopeTotal =
    categorizedGroups?.reduce((s, g) => s + g.subtotal, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* Validity notice */}
      <ValidityNotice validity={validity} />

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
        {/* Category distribution bar */}
        {hasCategorized && (
          <div className="px-4 pt-4 pb-1">
            <CategoryDistributionBar groups={categorizedGroups} total={scopeTotal} />
          </div>
        )}

        {/* Mini progress */}
        {sections.length > 0 && (
          <div className="px-4 pt-2 pb-1">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            <p className="text-[13px] text-muted-foreground font-body mt-1.5 tabular-nums">
              {activeIndex >= 0 ? activeIndex + 1 : 0} de {sections.length} seções
            </p>
          </div>
        )}

        {/* Header */}
        <div className="bg-primary mx-4 mt-2 rounded-lg px-4 py-3">
          <h3 className="font-display font-bold text-sm text-primary-foreground tracking-wide">
            Resumo do Orçamento
          </h3>
        </div>

        {/* Categories list */}
        <div className="px-4 pt-4 pb-2">
          {hasCategorized ? (
            <CategorizedList
              groups={categorizedGroups}
              displayedCategories={DISPLAYED_CATEGORIES}
              onDetailOpen={setDetailGroup}
            />
          ) : (
            <FlatSectionList
              sections={sections}
              activeSection={activeSection}
              activeRef={activeRef}
            />
          )}
        </div>

        {/* Adjustments */}
        {adjustments.length > 0 && (
          <AdjustmentsList adjustments={adjustments} />
        )}

        {/* Total card */}
        <TotalCard total={total} />

        {/* Footer */}
        {generatedAt && (
          <div className="px-4 pb-4">
            <p className="text-[13px] text-muted-foreground/70 text-center font-body">
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

/* ── Sub-components ── */

function ValidityNotice({ validity }: { validity: ReturnType<typeof getValidityInfo> | null }) {
  if (!validity) return null;

  return (
    <div
      className={cn(
        "rounded-xl p-3 flex items-start gap-2.5",
        validity.expired
          ? "bg-destructive/10 border border-destructive/20"
          : "bg-warning/10 border border-warning/20"
      )}
    >
      {validity.expired ? (
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
      ) : (
        <Clock className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
      )}
      <p
        className={cn(
          "text-[13px] font-body leading-relaxed",
          validity.expired ? "text-destructive" : "text-foreground"
        )}
      >
        {validity.expired
          ? "Valores e condições expirados — solicite uma atualização."
          : `Valores válidos até ${formatDateLong(validity.expiresAt)}.`}
      </p>
    </div>
  );
}

function CategorizedList({
  groups,
  displayedCategories,
  onDetailOpen,
}: {
  groups: CategorizedGroup[];
  displayedCategories: string[];
  onDetailOpen: (g: CategorizedGroup) => void;
}) {
  return (
    <div className="divide-y divide-border/60">
      {groups.map((group) => {
        const isDisplayed = displayedCategories.includes(group.category.id);

        return (
          <button
            key={group.category.id}
            onClick={() => {
              if (isDisplayed) {
                const firstId = `section-${group.sections[0]?.id}`;
                document
                  .getElementById(firstId)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                onDetailOpen(group);
              }
            }}
            className={cn(
              "w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0",
              "group transition-colors duration-150",
              "hover:bg-muted/30 rounded-md px-1 -mx-1"
            )}
          >
            {/* Color indicator */}
            <div
              className={cn(
                "w-1 min-h-[28px] self-stretch rounded-full transition-all",
                group.category.bgClass
              )}
            />

            {/* Label — sentence case, no uppercase */}
            <span className="flex-1 text-[13px] font-display font-semibold text-foreground text-left leading-snug">
              {group.category.label}
            </span>

            {/* Value */}
            <span className="text-sm font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
              {formatBRL(group.subtotal)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FlatSectionList({
  sections,
  activeSection,
  activeRef,
}: {
  sections: any[];
  activeSection: string | null | undefined;
  activeRef: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="divide-y divide-border/50">
      {sections.map((section: any) => {
        const sectionElId = `section-${section.id}`;
        const isActive = activeSection === sectionElId;
        const subtotal = calculateSectionSubtotal(section);

        return (
          <button
            key={section.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => {
              document
                .getElementById(sectionElId)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(
              "w-full text-left group flex items-center justify-between py-2.5 px-2 rounded-md transition-all duration-200",
              isActive && "border-l-2 border-primary bg-primary/5",
              !isActive && "border-l-2 border-transparent",
              "hover:bg-muted/40"
            )}
          >
            <span
              className={cn(
                "text-[13px] font-body truncate mr-3",
                isActive ? "text-foreground font-medium" : "text-muted-foreground",
                "group-hover:text-foreground"
              )}
            >
              {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}
              {section.title}
            </span>
            <span
              className={cn(
                "text-sm font-mono tabular-nums whitespace-nowrap",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {formatBRL(subtotal)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function AdjustmentsList({ adjustments }: { adjustments: any[] }) {
  return (
    <div className="px-4 pt-1 pb-2 space-y-1">
      <div className="border-t border-border pt-2 space-y-1.5">
        {adjustments.map((adj: any) => (
          <div key={adj.id} className="flex items-center justify-between px-2">
            <span className="text-[13px] text-muted-foreground font-body">
              {adj.label}
            </span>
            <span
              className={cn(
                "text-[13px] font-medium font-mono tabular-nums",
                adj.sign > 0 ? "text-foreground" : "text-success"
              )}
            >
              {adj.sign > 0 ? "+" : "-"} {formatBRL(Math.abs(adj.amount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalCard({ total }: { total: number }) {
  return (
    <div className="mx-4 mt-3 mb-3 rounded-xl bg-primary/5 border border-primary/15 p-4">
      <p className="text-[13px] font-display font-medium text-muted-foreground tracking-wide mb-1">
        Investimento Total
      </p>
      <motion.p
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="font-display font-extrabold text-2xl text-primary tabular-nums leading-tight"
      >
        {formatBRL(total)}
      </motion.p>
      <div className="flex items-center gap-1.5 mt-2">
        <Shield className="h-3.5 w-3.5 text-primary/50" />
        <span className="text-[13px] text-muted-foreground font-body">
          Preço fixo · Sem custos ocultos
        </span>
      </div>
    </div>
  );
}
