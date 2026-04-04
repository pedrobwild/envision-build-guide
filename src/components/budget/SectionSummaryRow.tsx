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

const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

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
        {/* Color pip */}
        <div className={cn(
          "w-[3px] rounded-full flex-shrink-0 self-stretch min-h-[20px]",
          bgClass
        )} />

        {/* Title + item count */}
        <div className="flex-1 text-left min-w-0">
          <span className={cn(
            "font-body font-medium text-foreground leading-snug block truncate",
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

        {/* Chevron */}
        {hasItems && !forceExpanded && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        )}

        {/* Value */}
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

      {/* ── Percentage bar ── */}
      {percentage !== undefined && percentage > 0 && (
        <div className="px-3 pb-1">
          <div className="h-[2px] rounded-full bg-muted/40 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", bgClass)}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>
        </div>
      )}

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
              {items.map((item: any, idx: number) => (
                <motion.div
                  key={item.id}
                  initial={forceExpanded ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: idx * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start justify-between px-3 py-2.5 gap-3"
                >
                  <span className="text-[12px] font-body text-muted-foreground/70 leading-relaxed flex-1">
                    {item.qty && item.qty > 1 && (
                      <span className="font-mono text-[11px] text-muted-foreground/50 mr-1 tabular-nums" style={MONO_STYLE}>
                        {item.qty}×
                      </span>
                    )}
                    {item.title}
                  </span>
                  {item.unit && (
                    <span
                      className="text-[10px] text-muted-foreground/35 font-mono uppercase whitespace-nowrap tracking-wider mt-0.5 tabular-nums"
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
