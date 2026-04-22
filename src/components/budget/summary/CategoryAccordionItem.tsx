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
          "w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 min-h-[56px] sm:min-h-[64px]",
          hasItems ? "budget-focus-surface cursor-pointer" : "budget-focus cursor-default"
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
                  initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground/70 stroke-[2.5]" />
                </motion.div>
              ) : (
                <motion.div
                  key="plus"
                  initial={{ opacity: 0, scale: 0.6, rotate: 45 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.6, rotate: -45 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
                opacity: { duration: 0.32, ease: [0.4, 0, 0.2, 1], delay: 0.08 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.36, ease: [0.32, 0.72, 0, 1], delay: 0.04 },
                opacity: { duration: 0.18, ease: [0.4, 0, 1, 1] },
              },
            }}
            className="overflow-hidden"
          >
            <motion.div
              className="ml-[40px] sm:ml-[48px] mr-4 sm:mr-5 mb-4 sm:mb-5 pl-4 sm:pl-5 border-l border-border/40"
              initial={{ y: -6 }}
              animate={{ y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1], delay: 0.06 } }}
              exit={{ y: -4, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            >
              {data.items.map((item, idx) => {
                const hasDesc = !!item.description?.trim();
                const isItemExpanded = expandedItemId === item.id;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -3 }}
                    animate={{ opacity: 1, y: 0 }}
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
                      aria-expanded={hasDesc ? isItemExpanded : undefined}
                      className={cn(
                        "w-full flex items-start justify-between py-2.5 sm:py-3 gap-3 sm:gap-4 text-left -mx-2 px-2 rounded-md",
                        hasDesc ? "budget-focus-surface cursor-pointer" : "budget-focus cursor-default"
                      )}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Item bullet */}
                        <span
                          className={cn(
                            "mt-[9px] w-1 h-1 rounded-full flex-shrink-0 transition-colors",
                            isItemExpanded ? "bg-foreground/60" : "bg-muted-foreground/40"
                          )}
                          aria-hidden
                        />

                        <div className="flex-1 min-w-0">
                          <span className="text-[12.5px] sm:text-[13.5px] font-body text-foreground/85 leading-[1.55] tracking-[-0.005em]">
                            {item.qty && item.qty > 1 && (
                              <span className="budget-numeric text-[10.5px] sm:text-[11.5px] text-muted-foreground/70 mr-1.5">
                                {item.qty}×
                              </span>
                            )}
                            {item.title}
                          </span>

                          {/* Item description */}
                          <AnimatePresence initial={false}>
                            {isItemExpanded && hasDesc && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{
                                  height: "auto",
                                  opacity: 1,
                                  transition: {
                                    height: { duration: 0.35, ease: [0.32, 0.72, 0, 1] },
                                    opacity: { duration: 0.28, ease: [0.4, 0, 0.2, 1], delay: 0.06 },
                                  },
                                }}
                                exit={{
                                  height: 0,
                                  opacity: 0,
                                  transition: {
                                    height: { duration: 0.28, ease: [0.32, 0.72, 0, 1], delay: 0.04 },
                                    opacity: { duration: 0.16, ease: [0.4, 0, 1, 1] },
                                  },
                                }}
                                className="overflow-hidden"
                              >
                                <p className="mt-2 sm:mt-2.5 text-[11.5px] sm:text-[12.5px] font-body text-muted-foreground/85 leading-[1.65] whitespace-pre-line tracking-[-0.005em]">
                                  {item.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 mt-[2px]">
                        {item.unit && (
                          <span className="budget-numeric text-[9.5px] sm:text-[10px] text-muted-foreground/60 uppercase whitespace-nowrap tracking-[0.09em]">
                            {item.unit}
                          </span>
                        )}
                        {hasDesc && (
                          <span
                            className={cn(
                              "text-[9.5px] sm:text-[10px] font-body text-muted-foreground/55 transition-opacity tracking-[0.02em]",
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
