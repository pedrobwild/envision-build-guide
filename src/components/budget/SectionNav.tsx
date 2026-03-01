import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { List, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionNavProps {
  sections: any[];
}

export function SectionNav({ sections }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleScroll = useCallback(() => {
    const offset = 160;
    let current: string | null = null;
    for (const s of sections) {
      const el = document.getElementById(`section-${s.id}`);
      if (el) {
        const top = el.getBoundingClientRect().top;
        if (top <= offset) current = s.id;
      }
    }
    setActiveId(current);
  }, [sections]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollTo = (id: string) => {
    document.getElementById(`section-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (sections.length < 2) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-32"
    >
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-display font-bold text-foreground hover:bg-muted/50 transition-colors border-b border-border"
        >
          <List className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">Navegação</span>
          <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <nav className="py-1 max-h-[50vh] overflow-y-auto">
                {sections.map((s, idx) => {
                  const isActive = activeId === s.id;
                  const subtotal = calculateSectionSubtotal(s);
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all relative group",
                        isActive
                          ? "bg-primary/8 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      {/* Active indicator bar */}
                      <motion.div
                        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary"
                        initial={false}
                        animate={{ opacity: isActive ? 1 : 0, scaleY: isActive ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                      />

                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:bg-accent"
                      )}>
                        {idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-sm font-body truncate transition-colors",
                          isActive ? "font-semibold" : "font-normal"
                        )}>
                          {s.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-body">
                          {formatBRL(subtotal)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
