import { useEffect, useState } from "react";

interface StepProgressIndicatorProps {
  sectionIds: string[];
}

const STEP_LABELS: Record<string, string> = {
  "mobile-included": "Escopo",
  "mobile-scope": "Itens",
  "mobile-trust": "Portfólio",
  "mobile-portal": "Portal",
  "mobile-next-steps": "Próximos",
  "mobile-faq": "FAQ",
};

export function StepProgressIndicator({ sectionIds }: StepProgressIndicatorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const total = sectionIds.length;

  useEffect(() => {
    if (total === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the last visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => sectionIds.indexOf(e.target.id))
          .filter((i) => i >= 0);

        if (visible.length > 0) {
          setCurrentStep(Math.max(...visible) + 1);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sectionIds, total]);

  if (total === 0) return null;

  return (
    <span className="text-[11px] font-body font-medium text-muted-foreground/80 tabular-nums">
      {currentStep}/{total}
    </span>
  );
}
