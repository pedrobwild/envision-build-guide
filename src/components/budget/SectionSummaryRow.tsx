import { useState } from "react";
import { ChevronDown } from "lucide-react";
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

  return (
    <div>
      <button
        onClick={() => hasItems && !forceExpanded && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 rounded-lg transition-all duration-200",
          compact ? "px-1 py-3" : "px-2 -mx-2 py-3",
          hasItems && !forceExpanded && "hover:bg-muted/40 active:bg-muted/60 cursor-pointer",
          !hasItems && "cursor-default",
          expanded && !forceExpanded && "bg-muted/30"
        )}
      >
        {/* Color indicator — thinner, taller */}
        <div className={cn("w-[3px] rounded-full flex-shrink-0 self-stretch min-h-[20px]", bgClass)} />

        {/* Section title */}
        <span className={cn(
          "flex-1 font-body font-medium text-foreground text-left leading-snug",
          compact ? "text-[13px]" : "text-sm"
        )}>
          {toTitleCase(section.title)}
        </span>

        {/* Chevron */}
        {hasItems && !forceExpanded && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        )}

        {/* Value */}
        <span className={cn(
          "font-mono tabular-nums font-semibold text-foreground whitespace-nowrap",
          compact ? "text-[13px]" : "text-sm"
        )}>
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
            <div className={cn(
              "ml-[15px] border-l border-border/30 pl-4 space-y-0",
              compact ? "mb-1 pb-1" : "mb-2 pb-1"
            )}>
              {items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-baseline justify-between py-1.5"
                >
                  <span className="text-xs font-body text-muted-foreground leading-relaxed mr-3 flex-1">
                    {item.qty && item.qty > 1 ? `${item.qty}× ` : ""}
                    {item.title}
                  </span>
                  {item.unit && (
                    <span className="text-[10px] text-muted-foreground/50 font-body whitespace-nowrap">
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
