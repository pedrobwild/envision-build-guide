import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "mobile-included", label: "Serviços" },
  { id: "resumo-financeiro", label: "Investimento" },
  { id: "mobile-scope", label: "Itens" },
  { id: "mobile-portal", label: "Portal" },
  { id: "mobile-next-steps", label: "Próximos passos" },
  { id: "roi-full", label: "Retorno" },
];

export function MobileStepBreadcrumb() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleIndices = entries
          .filter((e) => e.isIntersecting)
          .map((e) => SECTIONS.findIndex((s) => s.id === e.target.id))
          .filter((i) => i >= 0);

        if (visibleIndices.length > 0) {
          setCurrentStep(Math.max(...visibleIndices));
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Show only after scrolling past hero (~300px)
  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollY.current;
        const pastHero = y > 300;
        // Hide when scrolling DOWN aggressively past 600px, show on scroll UP
        if (!pastHero) {
          setVisible(false);
        } else if (delta > 8 && y > 600) {
          setVisible(false);
        } else if (delta < -4) {
          setVisible(true);
        } else if (lastScrollY.current === 0) {
          setVisible(true);
        }
        lastScrollY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const total = SECTIONS.length;
  const currentLabel = SECTIONS[currentStep]?.label ?? "";
  const progress = ((currentStep + 1) / total) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="lg:hidden fixed top-[3px] left-0 right-0 z-[49] pointer-events-none will-change-transform"
        >
          {/* Background strip */}
          <div className="bg-card/85 backdrop-blur-xl border-b border-border/50 px-4 py-1.5 shadow-[0_1px_8px_-4px_hsl(var(--foreground)/0.06)]">
            <div className="flex items-center justify-between gap-3">
              {/* Step label */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentStep}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11.5px] font-display font-semibold text-foreground/85 tracking-[-0.005em] truncate"
                >
                  {currentLabel}
                </motion.span>
              </AnimatePresence>

              {/* Dots + counter */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-[5px]">
                  {SECTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        i === currentStep
                          ? "w-4 h-1.5 bg-primary"
                          : i < currentStep
                            ? "w-1.5 h-1.5 bg-primary/45"
                            : "w-1.5 h-1.5 bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-body text-muted-foreground/55 tabular-nums tracking-[0.01em]">
                  <span className="text-foreground/65 font-medium">{currentStep + 1}</span>
                  <span className="mx-0.5 text-muted-foreground/35">/</span>
                  {total}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-1 h-[2px] bg-muted/40 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
