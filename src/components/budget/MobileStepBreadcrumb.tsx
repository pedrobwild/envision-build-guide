import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "mobile-included", label: "Serviços" },
  { id: "resumo-financeiro", label: "Investimento" },
  { id: "mobile-scope", label: "Itens" },
  { id: "mobile-portal", label: "Portal" },
  { id: "mobile-next-steps", label: "Próximos passos" },
  { id: "mobile-faq", label: "FAQ" },
];

export function MobileStepBreadcrumb() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);

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
      const y = window.scrollY;
      setVisible(y > 300);
      lastScrollY.current = y;
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
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="lg:hidden fixed top-[3px] left-0 right-0 z-[49] pointer-events-none"
        >
          {/* Background strip */}
          <div className="bg-card/80 backdrop-blur-md border-b border-border/40 px-4 py-1.5">
            <div className="flex items-center justify-between gap-3">
              {/* Step label */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentStep}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] font-display font-semibold text-foreground/80"
                >
                  {currentLabel}
                </motion.span>
              </AnimatePresence>

              {/* Dots + counter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {SECTIONS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        i === currentStep
                          ? "w-4 h-1.5 bg-primary"
                          : i < currentStep
                            ? "w-1.5 h-1.5 bg-primary/40"
                            : "w-1.5 h-1.5 bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-body text-muted-foreground/60 tabular-nums">
                  {currentStep + 1}/{total}
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
