import { useState } from "react";
import { ChevronRight } from "lucide-react";
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

/* ── Typography tokens (branding: Sora / Inter / Geist Mono) ── */
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

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
    <div className={cn(
      "transition-colors duration-150",
      expanded && !forceExpanded && "bg-muted/[0.04] rounded-xl"
    )}>
      <button
        onClick={() => hasItems && !forceExpanded && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 transition-all duration-200",
          compact ? "px-2.5 py-3.5" : "px-2.5 -mx-2 py-3.5",
          hasItems && !forceExpanded && "hover:bg-muted/30 active:bg-muted/50 cursor-pointer rounded-xl",
          !hasItems && "cursor-default"
        )}
      >
        {/* Color indicator */}
        <div className={cn(
          "w-[3px] rounded-full flex-shrink-0 self-stretch min-h-[24px]",
          bgClass
        )} />

        {/* Section title — Inter (font-body) */}
        <div className="flex-1 text-left min-w-0">
          <span className={cn(
            "font-body font-medium text-foreground leading-snug block truncate",
            compact ? "text-[13px]" : "text-sm"
          )}>
            {toTitleCase(section.title)}
          </span>
        </div>

        {/* Chevron */}
        {hasItems && !forceExpanded && (
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0"
          >
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          </motion.div>
        )}

        {/* Value — Geist Mono (font-mono) */}
        <span
          className={cn(
            "font-mono tabular-nums font-semibold whitespace-nowrap text-foreground",
            compact ? "text-[13px]" : "text-sm"
          )}
          style={MONO_STYLE}
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
              "ml-5 pl-4 border-l border-border/40",
              compact ? "mb-2 pb-1.5 pt-0" : "mb-2 pb-1 pt-0.5"
            )}>
              {items.map((item: any, idx: number) => (
                <motion.div
                  key={item.id}
                  initial={forceExpanded ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start justify-between py-[6px] gap-3"
                >
                  {/* Item title — Inter (font-body) */}
                  <span className="text-[12px] font-body text-muted-foreground leading-relaxed flex-1">
                    {item.qty && item.qty > 1 && (
                      <span className="font-mono text-[11px] text-muted-foreground/60 mr-1 tabular-nums" style={MONO_STYLE}>
                        {item.qty}×
                      </span>
                    )}
                    {item.title}
                  </span>
                  {/* Unit — Geist Mono (font-mono) */}
                  {item.unit && (
                    <span
                      className="text-[10px] text-muted-foreground/40 font-mono uppercase whitespace-nowrap tracking-wider mt-0.5 tabular-nums"
                      style={MONO_STYLE}
                    >
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
