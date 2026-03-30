import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NavItem {
  id: string;
  label: string;
  icon?: string; // emoji or short symbol
}

interface MobileSectionNavProps {
  items: NavItem[];
  activeId: string | null;
}

export function MobileSectionNav({ items, activeId }: MobileSectionNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Active index for progress
  const activeIndex = activeId ? items.findIndex((i) => i.id === activeId) : -1;
  const progress = activeIndex >= 0 ? ((activeIndex + 1) / items.length) * 100 : 0;

  // Scroll active pill into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [activeId]);

  // Detect sticky state
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Sentinel element to detect when nav becomes sticky */}
      <div ref={sentinelRef} className="lg:hidden h-0" />

      <nav
        className={cn(
          "lg:hidden sticky top-0 z-30 transition-all duration-200",
          isSticky
            ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
            : "bg-transparent"
        )}
        role="navigation"
        aria-label="Navegação de seções"
      >
        {/* Progress bar — only when sticky */}
        {isSticky && progress > 0 && (
          <motion.div
            className="h-0.5 bg-primary/20 w-full"
            initial={false}
          >
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </motion.div>
        )}

        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 py-2"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item, index) => {
            const isActive = activeId === item.id;
            const isPast = activeIndex >= 0 && index < activeIndex;
            return (
              <button
                key={item.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "relative flex-shrink-0 min-h-[40px] px-4 py-2 rounded-full text-[13px] font-body font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "text-primary-foreground"
                    : isPast
                      ? "text-primary bg-primary/10 active:bg-primary/15"
                      : "text-muted-foreground bg-muted/50 active:bg-muted"
                )}
                style={{ scrollSnapAlign: "start" }}
                aria-current={isActive ? "true" : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {item.icon && <span className="text-xs">{item.icon}</span>}
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
