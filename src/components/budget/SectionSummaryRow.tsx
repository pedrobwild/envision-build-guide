import { useState } from "react";
import { ChevronRight, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import type { BudgetSection } from "@/types/budget";

const LOWERCASE_WORDS = new Set(["e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "por", "para", "ao", "aos"]);

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && LOWERCASE_WORDS.has(word)) ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface SectionSummaryRowProps {
  section: BudgetSection;
  colorClass: string;
  bgClass: string;
  forceExpanded?: boolean;
  compact?: boolean;
  /** Controlled mode: parent manages expanded state */
  isExpanded?: boolean;
  onToggle?: () => void;
  /** Percentage of total for the subtle bar */
  percentage?: number;
}

export function SectionSummaryRow({
  section,
  colorClass,
  bgClass,
  forceExpanded = false,
  compact = false,
  isExpanded,
  onToggle,
  percentage,
}: SectionSummaryRowProps) {
  // Support both controlled and uncontrolled modes
  const controlled = isExpanded !== undefined;
  const expanded = controlled ? isExpanded : forceExpanded;

  const subtotal = calculateSectionSubtotal(section);
  const items = section.items || [];
  const hasItems = items.length > 0;

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const handleClick = () => {
    if (!hasItems || forceExpanded) return;
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <div className="transition-colors duration-150">
      {/* ── Row trigger ── */}
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 transition-all duration-200",
          compact ? "px-3 py-3" : "px-3 py-3.5",
          hasItems && !forceExpanded && "active:bg-muted/40 cursor-pointer",
          !hasItems && "cursor-default"
        )}
      >
        {/* Premium expand indicator (replaces neutral side bar) */}
        {hasItems && !forceExpanded ? (
          <div
            className={cn(
              "relative flex items-center justify-center flex-shrink-0 rounded-full border transition-all duration-200",
              "h-6 w-6",
              expanded
                ? "border-foreground/25 bg-foreground/[0.04]"
                : "border-border/60 bg-transparent group-hover:border-foreground/30"
            )}
            aria-hidden
          >
            <AnimatePresence mode="wait" initial={false}>
              {expanded ? (
                <motion.span
                  key="minus"
                  initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Minus className="h-3 w-3 text-foreground" strokeWidth={2.25} />
                </motion.span>
              ) : (
                <motion.span
                  key="plus"
                  initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" strokeWidth={2.25} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="w-6 flex-shrink-0" aria-hidden />
        )}

        {/* Title + item count */}
        <div className="flex-1 text-left min-w-0">
          <span className={cn(
            "font-body font-medium text-foreground leading-snug block",
            compact ? "text-[13px]" : "text-sm"
          )}>
            {toTitleCase(section.title)}
          </span>
          {hasItems && !forceExpanded && (
            <span className="text-[11px] font-body text-muted-foreground mt-0.5 block">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          )}
        </div>


        {/* Value */}
        <span
          className={cn(
            "budget-currency font-semibold whitespace-nowrap text-foreground",
            compact ? "text-[13px]" : "text-sm"
          )}
        >
          {formatBRL(subtotal)}
        </span>
      </button>

      {/* Percentage bar removed — kept neutral layout only */}

      {/* ── Expanded items ── */}
      <AnimatePresence initial={false}>
        {(expanded || forceExpanded) && hasItems && (
          <motion.div
            initial={forceExpanded ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn(
              "mx-3 mb-3 rounded-lg bg-muted/[0.03] border border-border/30 divide-y divide-border/[0.06]"
            )}>
              {items.map((item, idx) => {
                const hasDesc = !!item.description?.trim();
                const isItemExpanded = expandedItemId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={forceExpanded ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button
                      type="button"
                      onClick={hasDesc ? (e) => { e.stopPropagation(); setExpandedItemId(isItemExpanded ? null : item.id); } : undefined}
                      className={cn(
                        "w-full flex items-start justify-between px-3 py-2.5 gap-3 text-left transition-colors",
                        hasDesc && "cursor-pointer hover:bg-muted/30 active:bg-muted/50",
                        !hasDesc && "cursor-default"
                      )}
                    >
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        {hasDesc && (
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 text-muted-foreground/60 mt-0.5 flex-shrink-0 transition-transform duration-200",
                              isItemExpanded && "rotate-90"
                            )}
                          />
                        )}
                        <span className="text-[12px] font-body text-muted-foreground leading-relaxed flex-1">
                          {item.qty && item.qty > 1 && (
                            <span className="budget-numeric text-[11px] text-muted-foreground mr-1">
                              {item.qty}×
                            </span>
                          )}
                          {item.title}
                        </span>
                      </div>
                      {item.unit && (
                        <span className="budget-numeric text-[10px] text-muted-foreground uppercase whitespace-nowrap tracking-wider mt-0.5">
                          {item.unit}
                        </span>
                      )}
                    </button>

                    {/* Item description */}
                    <AnimatePresence initial={false}>
                      {isItemExpanded && hasDesc && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-3 pb-3 pl-7 text-[11px] font-body text-muted-foreground leading-relaxed whitespace-pre-line">
                            {item.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
