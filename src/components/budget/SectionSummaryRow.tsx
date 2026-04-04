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
          "w-full flex items-center gap-3 rounded-xl transition-all duration-200",
          compact ? "px-2 py-3" : "px-2 -mx-2 py-3",
          hasItems && !forceExpanded && "hover:bg-muted/40 active:bg-muted/60 cursor-pointer",
          !hasItems && "cursor-default",
          expanded && !forceExpanded && "bg-muted/20"
        )}
      >
        {/* Color indicator */}
        <div className={cn("w-[3px] rounded-full flex-shrink-0 self-stretch min-h-[20px]", bgClass)} />

        {/* Section title + item count */}
        <div className="flex-1 text-left min-w-0">
          <span className={cn(
            "font-body font-medium text-foreground leading-snug block truncate",
            compact ? "text-[13px]" : "text-sm"
          )}>
            {toTitleCase(section.title)}
          </span>
          {hasItems && !forceExpanded && (
            <span className="text-[10px] font-body text-muted-foreground/50 mt-0.5 block">
              {items.length} {items.length === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        {/* Chevron */}
        {hasItems && !forceExpanded && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
          </motion.div>
        )}

        {/* Value */}
        <span
          className={cn(
            "font-mono tabular-nums font-semibold text-foreground whitespace-nowrap tracking-tight",
            compact ? "text-[13px]" : "text-sm"
          )}
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
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
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn(
              "ml-[17px] border-l-2 border-border/20 pl-4",
              compact ? "mb-2 pb-1 pt-0.5" : "mb-2 pb-1 pt-0.5"
            )}>
              {items.map((item: any, idx: number) => (
                <motion.div
                  key={item.id}
                  initial={forceExpanded ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-baseline justify-between py-[5px]"
                >
                  <span className="text-[12px] font-body text-muted-foreground/70 leading-relaxed mr-3 flex-1">
                    {item.qty && item.qty > 1 && (
                      <span className="font-mono text-[11px] text-muted-foreground/50 mr-1 tabular-nums">
                        {item.qty}×
                      </span>
                    )}
                    {item.title}
                  </span>
                  {item.unit && (
                    <span className="text-[10px] text-muted-foreground/40 font-mono uppercase whitespace-nowrap tracking-wide">
                      {item.unit}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
