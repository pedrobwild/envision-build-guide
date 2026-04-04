import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

const MONO_STYLE: React.CSSProperties = {
  fontFeatureSettings: '"tnum" 1',
  letterSpacing: "-0.02em",
};

const LOWERCASE_WORDS = new Set([
  "e","de","do","da","dos","das","em","no","na","nos","nas","com","por","para","ao","aos",
]);

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && LOWERCASE_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export interface CategoryAccordionItemData {
  id: string;
  title: string;
  subtotal: number;
  bgClass: string;
  colorClass: string;
  percentage: number;
  items: Array<{
    id: string;
    title: string;
    qty?: number | null;
    unit?: string | null;
  }>;
}

interface CategoryAccordionItemProps {
  data: CategoryAccordionItemData;
  expanded: boolean;
  onToggle: () => void;
}

export function CategoryAccordionItem({
  data,
  expanded,
  onToggle,
}: CategoryAccordionItemProps) {
  const regionId = useId();
  const triggerId = useId();
  const hasItems = data.items.length > 0;

  return (
    <div className="transition-colors duration-150">
      {/* ── Trigger ── */}
      <button
        id={triggerId}
        onClick={hasItems ? onToggle : undefined}
        aria-expanded={hasItems ? expanded : undefined}
        aria-controls={hasItems ? regionId : undefined}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 transition-all duration-200 min-h-[48px]",
          hasItems && "active:bg-muted/40 cursor-pointer",
          !hasItems && "cursor-default",
          "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] rounded-lg"
        )}
      >
        {/* Color pip */}
        <div
          className={cn(
            "w-[3px] rounded-full flex-shrink-0 self-stretch min-h-[20px]",
            data.bgClass
          )}
          aria-hidden
        />

        {/* Title + count */}
        <div className="flex-1 text-left min-w-0">
          <span className="font-body font-medium text-foreground leading-snug block truncate text-[13px]">
            {toTitleCase(data.title)}
          </span>
          {hasItems && (
            <span className="text-[11px] font-body text-muted-foreground mt-0.5 block">
              {data.items.length} {data.items.length === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        {/* Chevron */}
        {hasItems && (
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0"
            aria-hidden
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        )}

        {/* Value */}
        <span
          className="font-mono tabular-nums font-semibold whitespace-nowrap text-foreground text-[13px]"
          style={MONO_STYLE}
        >
          {formatBRL(data.subtotal)}
        </span>
      </button>

      {/* ── Percentage bar ── */}
      {data.percentage > 0 && (
        <div className="px-3 pb-1" aria-hidden>
          <div className="h-[2px] rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", data.bgClass)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(data.percentage, 100)}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            />
          </div>
        </div>
      )}

      {/* ── Expanded items panel ── */}
      <AnimatePresence initial={false}>
        {expanded && hasItems && (
          <motion.div
            id={regionId}
            role="region"
            aria-labelledby={triggerId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 rounded-lg bg-muted/[0.03] border border-border/30 divide-y divide-border/[0.06]">
              {data.items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.15,
                    delay: idx * 0.02,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex items-start justify-between px-3 py-2.5 gap-3"
                >
                  <span className="text-[12px] font-body text-foreground/80 leading-relaxed flex-1">
                    {item.qty && item.qty > 1 && (
                      <span
                        className="font-mono text-[11px] text-muted-foreground mr-1 tabular-nums"
                        style={MONO_STYLE}
                      >
                        {item.qty}×
                      </span>
                    )}
                    {item.title}
                  </span>
                  {item.unit && (
                    <span
                      className="text-[10px] text-muted-foreground font-mono uppercase whitespace-nowrap tracking-wider mt-0.5 tabular-nums"
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
