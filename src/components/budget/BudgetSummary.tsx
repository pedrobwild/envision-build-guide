import { useRef, useEffect, useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL, formatDate, formatDateLong, getValidityInfo } from "@/lib/formatBRL";
import { Clock, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CategoryDistributionBar } from "@/components/budget/CategoryDistributionBar";
import { CategoryDetailDialog } from "@/components/budget/CategoryDetailDialog";
import { SectionSummaryRow } from "@/components/budget/SectionSummaryRow";
import { CountUpValue } from "@/components/budget/CountUpValue";
import { InstallmentSimulator } from "@/components/budget/summary/InstallmentSimulator";
import { TrustBadgesRow } from "@/components/budget/summary/TrustBadgesRow";
import type { CategorizedGroup } from "@/lib/scope-categories";
import type { SectionWithItems, AdjustmentRow } from "@/types/budget-common";

interface BudgetSummaryProps {
  sections: SectionWithItems[];
  adjustments: AdjustmentRow[];
  total: number;
  generatedAt: string;
  budgetDate?: string | null;
  validityDays?: number;
  activeSection?: string | null;
  categorizedGroups?: CategorizedGroup[];
  budgetId?: string;
  editable?: boolean;
  allCategoriesOpenSheet?: boolean;
  forceExpandItems?: boolean;
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
  budgetId,
  editable = false,
  allCategoriesOpenSheet = false,
  forceExpandItems = false,
}: BudgetSummaryProps) {
  const validity = budgetDate ? getValidityInfo(budgetDate, validityDays) : null;

  const sectionElementIds = sections.map((s) => `section-${s.id}`);
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
  const [installments, setInstallments] = useState(18);

  const DISPLAYED_CATEGORIES = allCategoriesOpenSheet ? [] : ["marcenaria", "mobiliario", "eletro"];

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

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl">
        {/* Header — clean, typographic */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground mb-1">
            Investimento
          </p>
          <h3 className="font-display font-bold text-base text-foreground tracking-tight">
            Resumo do Orçamento
          </h3>
          <p className="mt-1.5 text-xs text-muted-foreground font-body">
            Clique em cada tópico para visualizar o escopo detalhado
          </p>
        </div>

        {/* Category distribution bar */}
        {hasCategorized && (
          <div className="px-5 pb-2">
            <CategoryDistributionBar groups={categorizedGroups} total={scopeTotal} />
          </div>
        )}

        {/* Divider */}
        <div className="mx-5 border-t border-border" />

        {/* Categories list */}
        <div className="px-5 py-4">
          {hasCategorized ? (
            <CategorizedList
              groups={categorizedGroups}
              displayedCategories={DISPLAYED_CATEGORIES}
              onDetailOpen={setDetailGroup}
              forceExpandItems={forceExpandItems}
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
        <TotalCard total={total} installments={installments} />

        {/* Installment simulator */}
        <div className="px-5 pb-2">
          <InstallmentSimulator
            total={total}
            installments={installments}
            onInstallmentsChange={setInstallments}
          />
        </div>

        {/* Footer */}
        {generatedAt && (
          <div className="px-5 pb-4 pt-1">
            <p className="text-[13px] text-muted-foreground text-center font-body">
              Gerado em {formatDate(generatedAt)}
            </p>
          </div>
        )}
      </div>

      <CategoryDetailDialog
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        group={detailGroup}
        budgetId={budgetId}
        editable={editable}
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
        "rounded-xl p-3.5 flex items-start gap-2.5",
        validity.expired
          ? "bg-destructive/8 border border-destructive/15"
          : "bg-warning/8 border border-warning/15"
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
  forceExpandItems = false,
}: {
  groups: CategorizedGroup[];
  displayedCategories: string[];
  onDetailOpen: (g: CategorizedGroup) => void;
  forceExpandItems?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-0.5">
      {groups.map((group) =>
        group.sections.map((section) => (
          <SectionSummaryRow
            key={section.id}
            section={section}
            colorClass={group.category.colorClass}
            bgClass={group.category.bgClass}
            forceExpanded={forceExpandItems}
            isExpanded={expandedId === section.id}
            onToggle={() => setExpandedId((prev) => (prev === section.id ? null : section.id))}
          />
        ))
      )}
    </div>
  );
}

function FlatSectionList({
  sections,
  activeSection,
  activeRef,
}: {
  sections: SectionWithItems[];
  activeSection: string | null | undefined;
  activeRef: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="space-y-0.5">
      {sections.map((section) => {
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
              "w-full text-left group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200",
              isActive && "bg-primary/5 border-l-2 border-primary",
              !isActive && "border-l-2 border-transparent",
              "hover:bg-muted/40"
            )}
          >
            <span
              className={cn(
                "text-sm font-body truncate mr-3",
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
    <div className="px-5 pb-3">
      <div className="border-t border-border pt-3 space-y-2">
        {adjustments.map((adj: any) => (
          <div key={adj.id} className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground font-body">
              {adj.label}
            </span>
            <span
              className={cn(
                "text-sm font-medium font-mono tabular-nums",
                adj.sign > 0 ? "text-foreground" : "text-success"
              )}
            >
              {adj.sign > 0 ? "+" : "−"} {formatBRL(Math.abs(adj.amount))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalCard({ total, installments }: { total: number; installments: number }) {
  const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

  return (
    <div
      className="mx-5 mb-4 rounded-xl border border-primary/10 px-5 py-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)',
        boxShadow: '0 8px 28px -8px hsl(var(--primary) / 0.10), 0 2px 8px -2px hsl(var(--primary) / 0.04)',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-44 h-44 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)' }}
        aria-hidden
      />
      <div className="relative space-y-3">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground">
            Investimento Total
          </p>
          <CountUpValue
            value={total}
            className={cn(
              "font-mono font-extrabold text-primary leading-none block tabular-nums",
              total >= 1_000_000 ? "text-[1.5rem]" : "text-[1.875rem]"
            )}
            style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}
          />
        </div>

        {/* Installment preview */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[12px] font-body text-muted-foreground">ou</span>
          <span
            className="font-mono text-sm font-semibold text-foreground tabular-nums"
            style={MONO_STYLE}
          >
            {formatBRL(total / installments)}
          </span>
          <span className="text-[12px] font-body text-muted-foreground">
            em {installments}× sem juros
          </span>
        </div>

        <TrustBadgesRow />
      </div>
    </div>
  );
}
