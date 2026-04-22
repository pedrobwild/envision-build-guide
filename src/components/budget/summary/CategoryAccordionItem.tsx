import { useId, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

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
    description?: string | null;
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  return (
    <div className="group/category transition-colors duration-200">
      {/* ── Trigger ── */}
      <button
        id={triggerId}
        onClick={hasItems ? onToggle : undefined}
        aria-expanded={hasItems ? expanded : undefined}
        aria-controls={hasItems ? regionId : undefined}
        className={cn(
          "w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 transition-all duration-200 min-h-[56px] sm:min-h-[64px]",
          hasItems && "hover:bg-muted/[0.03] active:bg-muted/[0.06] cursor-pointer",
          !hasItems && "cursor-default",
          "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
        )}
      >
        {/* Expand/Collapse indicator — premium minimal */}
        {hasItems ? (
          <motion.div
            className={cn(
              "flex-shrink-0 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full",
              "border transition-all duration-200",
              expanded
                ? "border-foreground/25 bg-foreground/[0.04]"
                : "border-border/60 group-hover/category:border-foreground/30"
            )}
            aria-hidden
          >
            <AnimatePresence mode="wait" initial={false}>
              {expanded ? (
                <motion.div
                  key="minus"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                >
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground/70 stroke-[2.5]" />
                </motion.div>
              ) : (
                <motion.div
                  key="plus"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.15 }}
                >
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground/60 stroke-[2.5]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" aria-hidden />
        )}

        {/* Title + count */}
        <div className="flex-1 text-left min-w-0">
          <span className="font-display font-semibold text-foreground leading-snug block text-[13.5px] sm:text-[15px] tracking-[-0.012em]">
            {toTitleCase(data.title)}
          </span>
          {hasItems && (
            <span className="text-[10.5px] sm:text-[11.5px] font-body text-muted-foreground/70 mt-1 block tracking-[0.01em]">
              <span className="budget-numeric">{data.items.length}</span>{" "}
              {data.items.length === 1 ? "item incluso" : "itens inclusos"}
            </span>
          )}
        </div>

        {/* Value */}
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="budget-currency font-semibold whitespace-nowrap text-foreground text-[13.5px] sm:text-[15px] tracking-[-0.012em]">
            {formatBRL(data.subtotal)}
          </span>
          {data.percentage > 0 && (
            <span className="text-[10px] sm:text-[10.5px] font-body text-muted-foreground/55 mt-1 budget-numeric tracking-[0.04em]">
              {data.percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </button>

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
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-[44px] mr-5 mb-4 pl-5 border-l border-border/40">
              {data.items.map((item, idx) => {
                const hasDesc = !!item.description?.trim();
                const isItemExpanded = expandedItemId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: idx * 0.025,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="relative"
                  >
                    <button
                      type="button"
                      onClick={hasDesc ? () => setExpandedItemId(isItemExpanded ? null : item.id) : undefined}
                      className={cn(
                        "w-full flex items-start justify-between py-2.5 gap-4 text-left transition-colors",
                        hasDesc && "cursor-pointer hover:opacity-80",
                        !hasDesc && "cursor-default"
                      )}
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {/* Item bullet */}
                        <span
                          className={cn(
                            "mt-2 w-1 h-1 rounded-full flex-shrink-0 transition-colors",
                            isItemExpanded ? "bg-foreground/60" : "bg-muted-foreground/40"
                          )}
                          aria-hidden
                        />

                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-body text-foreground/85 leading-relaxed tracking-[-0.005em]">
                            {item.qty && item.qty > 1 && (
                              <span className="budget-numeric text-[11px] text-muted-foreground/70 mr-1.5">
                                {item.qty}×
                              </span>
                            )}
                            {item.title}
                          </span>

                          {/* Item description */}
                          <AnimatePresence initial={false}>
                            {isItemExpanded && hasDesc && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden"
                              >
                                <p className="mt-2 text-[12px] font-body text-muted-foreground/80 leading-relaxed whitespace-pre-line tracking-[-0.005em]">
                                  {item.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        {item.unit && (
                          <span className="budget-numeric text-[10px] text-muted-foreground/60 uppercase whitespace-nowrap tracking-[0.08em]">
                            {item.unit}
                          </span>
                        )}
                        {hasDesc && (
                          <span
                            className={cn(
                              "text-[10px] font-body text-muted-foreground/50 transition-opacity",
                              isItemExpanded ? "opacity-0" : "opacity-100"
                            )}
                          >
                            ver mais
                          </span>
                        )}
                      </div>
                    </button>
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
