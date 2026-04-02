import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import type { BudgetSection } from "@/types/budget";

/** Convert "SOME TITLE HERE" → "Some Título Here" (capitalize each word) */
function toTitleCase(str: string): string {
  if (!str) return str;
  return str.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

interface SectionSummaryRowProps {
  section: BudgetSection;
  colorClass: string;
  bgClass: string;
  /** When true, items are always expanded (used for PDF export) */
  forceExpanded?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
}

export function SectionSummaryRow({
  section,
  colorClass,
  bgClass,
  forceExpanded = false,
  compact = false,
}: SectionSummaryRowProps) {
  const [expanded, setExpanded] = useState(forceExpanded);
  const subtotal = calculateSectionSubtotal(section);
  const items = section.items || [];
  const hasItems = items.length > 0;

  const textSize = compact ? "text-[13px]" : "text-sm";
  const valueSize = compact ? "text-[13px]" : "text-sm";
  const py = compact ? "py-2.5" : "py-2.5";

  return (
    <div>
      <button
        onClick={() => hasItems && !forceExpanded && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2.5 rounded-lg transition-all duration-200",
          compact ? "px-1.5" : "px-2 -mx-2",
          py,
          hasItems && !forceExpanded && "hover:bg-muted/50 cursor-pointer",
          !hasItems && "cursor-default"
        )}
      >
        {/* Color indicator */}
        <div className={cn("w-1 rounded-full flex-shrink-0", compact ? "h-4" : "h-6", bgClass)} />

        {/* Section title */}
        {/* Section title */}
        <span className={cn("flex-1 font-body font-medium text-foreground text-left leading-snug", textSize)}>
          {toTitleCase(section.title)}
        </span>


        {/* Chevron */}
        {hasItems && !forceExpanded && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        )}

        {/* Value */}
        <span className={cn("font-mono tabular-nums font-semibold text-foreground whitespace-nowrap", valueSize)}>
          {formatBRL(subtotal)}
        </span>
      </button>

      {/* Expanded items list */}
      <AnimatePresence initial={false}>
        {(expanded || forceExpanded) && hasItems && (
          <motion.div
            initial={forceExpanded ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn("ml-4 border-l-2 border-border/40 pl-3 space-y-0", compact ? "mb-1" : "mb-2")}>
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-xs font-body text-muted-foreground leading-snug mr-2 flex-1">
                    {item.qty && item.qty > 1 ? `${item.qty}× ` : ""}
                    {item.title}
                  </span>
                  {item.unit && (
                    <span className="text-[10px] text-muted-foreground/60 font-body whitespace-nowrap">
                      {item.unit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
