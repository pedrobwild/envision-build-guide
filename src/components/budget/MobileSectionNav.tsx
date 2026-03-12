import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NavItem {
  id: string;
  label: string;
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
      >
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 py-2.5"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => scrollTo(item.id)}
                className={cn(
                  "relative flex-shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-body font-medium transition-colors whitespace-nowrap",
                  "scroll-snap-align-start",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground bg-muted/50 active:bg-muted"
                )}
                style={{ scrollSnapAlign: "start" }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
