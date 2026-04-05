import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MobileSwipeableKanbanProps {
  columns: {
    id: string;
    label: string;
    icon: React.ElementType;
    accent: string;
    headerColor: string;
    count: number;
    overdueCount?: number;
  }[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  children: (columnIndex: number) => React.ReactNode;
}

const SWIPE_THRESHOLD = 50;

export function MobileSwipeableKanban({
  columns,
  activeIndex,
  onChangeIndex,
  children,
}: MobileSwipeableKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(columns.length - 1, idx));
      onChangeIndex(clamped);
    },
    [columns.length, onChangeIndex]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD && info.velocity.x < 0) {
        goTo(activeIndex + 1);
      } else if (info.offset.x > SWIPE_THRESHOLD && info.velocity.x > 0) {
        goTo(activeIndex - 1);
      }
    },
    [activeIndex, goTo]
  );

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(activeIndex - 1);
      if (e.key === "ArrowRight") goTo(activeIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, goTo]);

  return (
    <div className="lg:hidden flex flex-col" ref={containerRef}>
      {/* Tab bar — scrollable pills */}
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        {columns.map((col, i) => {
          const Icon = col.icon;
          const isActive = i === activeIndex;
          return (
            <button
              key={col.id}
              onClick={() => goTo(i)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-display font-semibold whitespace-nowrap transition-all flex-shrink-0 min-h-[32px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden xs:inline">{col.label}</span>
              <span className={cn(
                "text-[10px] rounded-full px-1.5 min-w-[18px] text-center",
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/60"
              )}>
                {col.count}
              </span>
              {(col.overdueCount ?? 0) > 0 && (
                <span className="text-[9px] rounded-full px-1 bg-destructive/20 text-destructive font-bold">
                  !{col.overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Swipeable area */}
      <div className="relative overflow-hidden flex-1 min-h-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={activeIndex}
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            className="w-full"
          >
            {children(activeIndex)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 py-2">
        {columns.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === activeIndex
                ? "w-5 h-1.5 bg-primary"
                : "w-1.5 h-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40"
            )}
            aria-label={`Ir para coluna ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
